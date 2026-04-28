from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, Body
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
from dotenv import load_dotenv
import docker
import json
import time
from datetime import datetime, timezone
from typing import Optional
from supabase import ClientOptions 
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr

# --- SETUP ---
load_dotenv()

URL = os.getenv("SUPABASE_URL")
ANON_KEY = os.getenv("SUPABASE_KEY")  # This is your anon key
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not URL or not ANON_KEY:
    print("❌ Error: Supabase credentials not found in .env file")

# Create base client (for unauthenticated requests)
supabase: Client = create_client(URL, ANON_KEY)
supabase_admin: Client = create_client(URL, SERVICE_ROLE_KEY)

client = docker.from_env()

app = FastAPI()

email_config = ConnectionConfig(
    MAIL_USERNAME=os.getenv("SMTP_USER"),
    MAIL_PASSWORD=os.getenv("SMTP_PASSWORD"),
    MAIL_FROM=os.getenv("SMTP_USER"),
    MAIL_PORT=int(os.getenv("SMTP_PORT", 587)),
    MAIL_SERVER=os.getenv("SMTP_HOST", "smtp.gmail.com"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_authenticated_client(token: str):
    """Create a Supabase client with the user's JWT token"""
    options = ClientOptions(
        headers={"Authorization": f"Bearer {token}"}
    )
    return create_client(URL, ANON_KEY, options=options)

@app.get("/admin/users")
async def get_all_users():
    try:
        response = supabase.table("profiles") \
            .select("id, hero_name, xp_points, updated_at") \
            .order("xp_points", desc=True) \
            .execute()
        return response.data
    except Exception as e:
        print(f"Admin User Fetch Error: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve the hero directory.")


@app.get("/history/{user_id}/{problem_id}")
async def get_history(user_id: str, problem_id: str):
    try:
        response = supabase.table("submissions") \
            .select("created_at, status, speed_metaphor, execution_time") \
            .eq("user_id", user_id) \
            .eq("problem_id", problem_id) \
            .order("created_at", desc=True) \
            .limit(5) \
            .execute()
        return response.data
    except Exception as e:
        print(f"History Fetch Error: {e}")
        return []


@app.get("/mission/{mission_id}")
async def get_mission(mission_id: str):
    try:
        response = supabase.table("problems").select("*").eq("id", mission_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Mission not found in the vault!")
            
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.put("/mission/{mission_id}")
async def update_mission(mission_id: str, payload: dict = Body(...)):
    try:
        update_data = {
            "title": payload.get("title"),
            "story": payload.get("story"),
            "starter_code": payload.get("starter_code"),
            "difficulty": payload.get("difficulty"),
            "category": payload.get("category"),
            "test_cases": payload.get("test_cases"),
            "xp_reward": int(payload.get("xp_reward", 0)),
            "hints": payload.get("hints", []),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        response = supabase.table("problems") \
            .update(update_data) \
            .eq("id", mission_id) \
            .execute()
        
        return {"status": "success", "data": response.data}
    except Exception as e:
        print(f"Mission update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/mission/{mission_id}")
async def delete_mission(mission_id: str):
    try:
        # First, delete all submissions for this mission
        supabase.table("submissions").delete().eq("problem_id", mission_id).execute()
        
        # Then delete the mission
        response = supabase.table("problems").delete().eq("id", mission_id).execute()
        
        return {"status": "success", "message": "Mission and all submissions deleted"}
    except Exception as e:
        print(f"Mission delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run")
async def run_code(payload: dict = Body(None)):
    start_time = time.time()
    code = payload.get("code")
    test_cases = payload.get("test_cases")
    user_id = payload.get("user_id")
    problem_id = payload.get("problem_id")
    
    passed_count = 0
    total_tests = len(test_cases)
    results_log = []
    has_infinite_loop = False
    has_memory_error = False

    for test in test_cases:
        test_input = test["input"]
        expected_output = str(test["expected"])

        full_code = f"""
{code}
import inspect
import ast
import sys
import traceback
import time
import signal

class TimeoutError(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutError("Code took too long to run!")

# Set timeout for infinite loops (5 seconds)
signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(5)

try:
    sig = inspect.signature(solve)
    param_count = len(sig.parameters)
    
    input_str = {repr(test_input)}
    
    if input_str.strip().startswith('[') and input_str.strip().endswith(']'):
        args = ast.literal_eval(input_str)
        if param_count == 1:
            result = solve(args)
        else:
            result = solve(*args)
    else:
        raw_args = [x.strip() for x in input_str.split(',') if x.strip()]
        args = []
        for x in raw_args:
            try:
                if '.' in x:
                    args.append(float(x))
                else:
                    args.append(int(x))
            except:
                args.append(x)
        
        if param_count == 1 and len(args) > 1:
            result = solve(args)
        else:
            result = solve(*args)
    
    signal.alarm(0)  # Cancel timeout
    
    if result is not None:
        print(result)
    else:
        print("None")
except TimeoutError:
    print("ERROR_INFINITE_LOOP")
except MemoryError:
    print("ERROR_MEMORY")
except IndexError:
    print("ERROR_INDEX_OUT_OF_BOUNDS")
except ZeroDivisionError:
    print("ERROR_DIVISION_BY_ZERO")
except TypeError as e:
    if "unsupported operand type" in str(e):
        print("ERROR_TYPE_MISMATCH")
    else:
        print(f"ERROR_TYPE: {{e}}")
except NameError:
    print("ERROR_NAME_NOT_DEFINED")
except Exception as e:
    print(f"ERROR_GENERAL: {{e}}")
"""

        try:

            container_output = client.containers.run(
            "python:3.12-slim",
            command=["python", "-c", full_code],
            remove=True,
            network_disabled=True,
            mem_limit="128m"
            # Remove the timeout parameter from here
            )
    
            actual_output = container_output.decode("utf-8").strip()
            print(f"Input: {test_input}, Expected: {expected_output}, Got: '{actual_output}'")
            
            # Check for errors
            if actual_output.startswith("ERROR_"):
                if "INFINITE_LOOP" in actual_output:
                    has_infinite_loop = True
                elif "MEMORY" in actual_output:
                    has_memory_error = True
                results_log.append({
                    "input": test_input, 
                    "passed": False, 
                    "error": get_friendly_error_message(actual_output)
                })
                continue
                
            if actual_output == expected_output:
                passed_count += 1
                results_log.append({"input": test_input, "passed": True})
            else:
                results_log.append({
                    "input": test_input, 
                    "passed": False, 
                    "actual": actual_output, 
                    "expected": expected_output
                })
                
        except Exception as e:
            print(f"Container error: {e}")
            results_log.append({"input": test_input, "passed": False, "error": "Docker container error"})

    is_perfect = (passed_count == total_tests)
    execution_duration = round(time.time() - start_time, 3)
    
    # Advanced Complexity Calculation
    complexity = calculate_complexity(code, passed_count, total_tests, execution_duration)
    
    # Metaphor Logic with more options
    if execution_duration < 0.2:
        metaphor = "Cheetah 🐆"
        speed_rating = "Lightning Fast!"
    elif execution_duration < 0.5:
        metaphor = "Eagle 🦅"
        speed_rating = "Very Fast!"
    elif execution_duration < 1.0:
        metaphor = "Human 🏃"
        speed_rating = "Average Speed"
    elif execution_duration < 2.0:
        metaphor = "Turtle 🐢"
        speed_rating = "Slow"
    else:
        metaphor = "Snail 🐌"
        speed_rating = "Very Slow"

    # Save submission
    try:
        log_entry = {
            "user_id": user_id,
            "problem_id": problem_id,
            "source_code": code,
            "status": "Success" if is_perfect else "Fail",
            "passed_tests": passed_count,
            "total_tests": total_tests,
            "execution_time": float(execution_duration),
            "speed_metaphor": metaphor,
            "output": str(results_log)[:500]
        }
        
        supabase.table("submissions").insert(log_entry).execute()
        
    except Exception as e:
        print(f"⚠️ History Log Failed: {e}")

    return {
        "status": "Success" if is_perfect else "Fail",
        "passed_tests": passed_count,
        "total_tests": total_tests,
        "results": results_log,
        "speed_metaphor": metaphor,
        "speed_rating": speed_rating,
        "complexity": complexity,
        "duration": execution_duration,
        "has_infinite_loop": has_infinite_loop,
        "has_memory_error": has_memory_error
    }

def get_friendly_error_message(error_code: str):
    """Return child-friendly error messages"""
    errors = {
        "ERROR_INFINITE_LOOP": "🔄 Oops! Your code has an infinite loop! Make sure your loop has a way to stop. Try adding a condition that eventually becomes False.",
        "ERROR_MEMORY": "💾 Whoa! Your code is using too much memory! Try using less data or freeing memory when you're done with it.",
        "ERROR_INDEX_OUT_OF_BOUNDS": "📚 You're trying to access an element that doesn't exist! Like trying to open a book that only has 10 pages at page 11. Check your array/list bounds.",
        "ERROR_DIVISION_BY_ZERO": "➗ Uh-oh! You can't divide a number by zero! It's like trying to split a pizza among 0 friends. Make sure your divisor is not zero.",
        "ERROR_TYPE_MISMATCH": "🔤 You're mixing different types! Like trying to add a number to a word. Make sure all your variables are the same type.",
        "ERROR_NAME_NOT_DEFINED": "❓ You're using a variable that hasn't been created yet! Like talking about a friend you haven't met. Define your variable before using it.",
        "ERROR_GENERAL": "⚠️ Something unexpected happened! Read the error message carefully and check your code."
    }
    return errors.get(error_code, "⚠️ Something went wrong. Check your code and try again!")

def calculate_complexity(code: str, passed_tests: int, total_tests: int, duration: float):
    """Calculate code complexity based on various factors"""
    lines = len(code.split('\n'))
    loops = code.count('for ') + code.count('while ')
    functions = code.count('def ')
    nested_loops = code.count('for ') + code.count('while ') * 2
    
    complexity_score = (lines * 0.5) + (loops * 5) + (functions * 3) + (nested_loops * 2)
    
    if complexity_score < 10:
        level = "Simple 🎈"
        advice = "Great job! Your code is clean and efficient."
    elif complexity_score < 25:
        level = "Moderate 📚"
        advice = "Good structure! Consider breaking complex parts into smaller functions."
    elif complexity_score < 50:
        level = "Complex 🧩"
        advice = "Your code works, but try to simplify it. Remember the KISS principle (Keep It Simple, Student)!"
    else:
        level = "Advanced 🚀"
        advice = "Wow! Very sophisticated solution. Just make sure it's still readable for others."
    
    return {
        "level": level,
        "score": round(complexity_score, 2),
        "lines": lines,
        "loops": loops,
        "functions": functions,
        "advice": advice
    }

@app.get("/missions")
async def get_all_missions():
    response = supabase.table("problems").select("id", "title", "difficulty", "category","xp_reward").execute()
    return response.data


@app.post("/add-xp")
async def add_xp(
    payload: dict = Body(...),
    authorization: Optional[str] = Header(None)
):
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization token")
        
        token = authorization.replace("Bearer ", "")
        auth_client = get_authenticated_client(token)
        
        user_id = payload.get("user_id")
        xp_to_add = payload.get("xp_to_add")
        
        user = auth_client.table("profiles").select("xp_points").eq("id", user_id).execute()
        
        if not user.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        current_xp = user.data[0].get('xp_points', 0)
        new_xp = current_xp + xp_to_add
        
        auth_client.table("profiles").update({"xp_points": new_xp}).eq("id", user_id).execute()
        
        return {"status": "success", "new_xp": new_xp}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/profile/{user_id}")
async def get_profile(user_id: str):
    try:
        response = supabase.table("profiles") \
            .select("hero_name, role, age, school_name, avatar_url") \
            .eq("id", user_id) \
            .single() \
            .execute()
        return response.data
    except Exception as e:
        return {"hero_name": "Commander", "role": "student", "age": None, "school_name": None, "avatar_url": None}


@app.post("/update-profile")
async def update_profile(
    user_id: str = Form(...),
    hero_name: str = Form(...),
    age: str = Form(...),
    school_name: str = Form(...),
    avatar: UploadFile = File(None),
    authorization: Optional[str] = Header(None)
):
    try:
        print(f"Updating profile for user: {user_id}")
        print(f"Data received - hero_name: {hero_name}, age: {age}, school_name: {school_name}")
        
        # Check if user exists
        check_user = supabase.table("profiles").select("id").eq("id", user_id).execute()
        print(f"User exists: {len(check_user.data) > 0}")
        
        if not check_user.data:
            return {"status": "error", "message": "User not found"}
        
        # Extract token from Authorization header
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization token")
        
        token = authorization.replace("Bearer ", "")
        
        # Create authenticated client with user's token
        auth_client = get_authenticated_client(token)
        
        # Build update data
        update_data = {
            "hero_name": hero_name,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if age and age.strip():
            update_data["age"] = int(age)
        
        if school_name:
            update_data["school_name"] = school_name
        
        # Handle avatar upload if provided
        if avatar and avatar.filename:
            print(f"Avatar uploaded: {avatar.filename}")
            try:
                file_content = await avatar.read()
                file_ext = avatar.filename.split('.')[-1]
                file_name = f"{user_id}/avatar.{file_ext}"
                
                # Upload using authenticated client
                storage_response = auth_client.storage \
                    .from_("avatars") \
                    .upload(
                        path=file_name,
                        file=file_content,
                        file_options={"content-type": avatar.content_type, "upsert": "true"}
                    )
                
                avatar_url = auth_client.storage \
                    .from_("avatars") \
                    .get_public_url(file_name)
                
                update_data["avatar_url"] = avatar_url
                print(f"Avatar URL: {avatar_url}")
                
            except Exception as storage_error:
                print(f"Storage error: {storage_error}")
                # Continue without avatar
        
        # Update profile using authenticated client
        print(f"Update data: {update_data}")
        response = auth_client.table("profiles") \
            .update(update_data) \
            .eq("id", user_id) \
            .execute()
        
        print(f"Update response: {response}")
        print(f"Profile updated: {response.data}")
        
        if not response.data:
            return {"status": "error", "message": "Update failed - no rows updated"}
            
        return {"status": "success", "data": response.data}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Profile update error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/user-profile/{user_id}")
async def get_public_profile(user_id: str):
    try:
        print(f"📊 Fetching public profile for user: {user_id}")
        
        profile_res = supabase.table("profiles") \
            .select("*") \
            .eq("id", user_id) \
            .execute()
        
        print(f"Profile query result: {profile_res}")
        
        if not profile_res.data:
            print(f"❌ No profile found for user: {user_id}")
            return {
                "identity": {
                    "hero_name": "Hero",
                    "xp_points": 0,
                    "created_at": None,
                    "age": None,
                    "school_name": None,
                    "avatar_url": None
                },
                "submissions": []
            }
        
        # Fetch submissions
        subs_res = supabase.table("latest_user_submissions") \
            .select("*, problems!inner(title, category, difficulty)") \
            .eq("user_id", user_id) \
            .execute()
        
        return {
            "identity": profile_res.data[0],
            "submissions": subs_res.data or []
        }
    except Exception as e:
        print(f"💥 Error in get_public_profile: {e}")
        import traceback
        traceback.print_exc()
        return {
            "identity": {
                "hero_name": "Hero",
                "xp_points": 0,
                "created_at": None,
                "age": None,
                "school_name": None,
                "avatar_url": None
            },
            "submissions": []
        }


@app.get("/leaderboard")
async def get_leaderboard():
    try:
        response = supabase.table("profiles") \
            .select("id, hero_name, xp_points, avatar_url") \
            .eq("role", "student") \
            .order("xp_points", desc=True) \
            .limit(10) \
            .execute()
        return response.data
    except Exception as e:
        print(f"Leaderboard Error: {e}")
        return []


@app.post("/mission")
async def add_mission(payload: dict = Body(...)):
    try:
        response = supabase.table("problems").insert({
            "title": payload.get("title"),
            "story": payload.get("story"),
            "category": payload.get("category"),
            "difficulty": payload.get("difficulty"),
            "starter_code": payload.get("starter_code"),
            "test_cases": payload.get("test_cases"),
            "xp_reward": int(payload.get("xp_reward", 0)),
            "hints": payload.get("hints", [])
        }).execute()
        
        return {"status": "success", "data": response.data}
    except Exception as e:
        print("--- DATABASE ERROR ---")
        print(e) 
        print("-----------------------")
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/debug-profile/{user_id}")
async def debug_profile(user_id: str):
    try:
        response = supabase.table("profiles").select("*").eq("id", user_id).execute()
        return {
            "exists": len(response.data) > 0,
            "data": response.data,
            "count": len(response.data)
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/create-profile")
async def create_profile(payload: dict = Body(...)):  # ← remove authorization header
    try:
        user_id = payload.get("user_id")
        hero_name = payload.get("hero_name", "Hero")
        age = payload.get("age")
        school_name = payload.get("school_name")

        profile_data = {
            "id": user_id,
            "hero_name": hero_name,
            "xp_points": 0,
            "role": "student"
        }
        if age is not None:
            profile_data["age"] = int(age)
        if school_name:
            profile_data["school_name"] = school_name

        response = supabase_admin.table("profiles").upsert(profile_data).execute()  # ← supabase_admin
        return {"status": "success", "data": response.data}
    except Exception as e:
        print(f"Create profile error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/enquiries")
async def create_enquiry(payload: dict = Body(...)):
    try:
        user_id = payload.get("user_id")
        name = payload.get("name")
        email = payload.get("email")
        message = payload.get("message")
        
        if not name or not email or not message:
            raise HTTPException(status_code=400, detail="Name, email, and message are required")
        
        enquiry_data = {
            "user_id": user_id,
            "name": name,
            "email": email,
            "message": message,
            "status": "pending"
        }
        
        # ✅ Use supabase_admin to bypass RLS — backend is the trusted layer
        response = supabase_admin.table("enquiries").insert(enquiry_data).execute()
        
        return {"status": "success", "message": "Enquiry submitted successfully", "data": response.data}
        
    except Exception as e:
        print(f"Enquiry creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/admin/enquiries")
async def get_all_enquiries():
    try:
        response = supabase_admin.table("enquiries") \
            .select("*") \
            .order("created_at", desc=True) \
            .execute()
        return response.data
    except Exception as e:
        print(f"Enquiries Fetch Error: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve enquiries")


@app.put("/admin/enquiries/{enquiry_id}/status")
async def update_enquiry_status(enquiry_id: str, payload: dict = Body(...)):
    try:
        status = payload.get("status")
        response = supabase_admin.table("enquiries") \
            .update({"status": status}) \
            .eq("id", enquiry_id) \
            .execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        print(f"Status update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    
@app.put("/admin/enquiries/{enquiry_id}/reply")
async def reply_to_enquiry(enquiry_id: str, payload: dict = Body(...)):
    try:
        reply_message = payload.get("reply_message")
        status = payload.get("status", "replied")
        
        # First, get the enquiry to get user's email
        enquiry = supabase_admin.table("enquiries") \
            .select("*") \
            .eq("id", enquiry_id) \
            .execute()
        
        if not enquiry.data:
            raise HTTPException(status_code=404, detail="Enquiry not found")
        
        enquiry_data = enquiry.data[0]
        user_email = enquiry_data.get("email")
        user_name = enquiry_data.get("name")
        
        # Update the reply in database
        response = supabase_admin.table("enquiries") \
            .update({
                "reply_message": reply_message,
                "status": status,
                "replied_at": datetime.now(timezone.utc).isoformat()
            }) \
            .eq("id", enquiry_id) \
            .execute()
        
        # Prepare email content
        email_body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: 'Comic Sans MS', cursive; background: #f9f4e8; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 30px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(145deg, #FF8C42, #E67E22); color: white; padding: 30px; text-align: center; }}
                .content {{ padding: 30px; }}
                .reply-box {{ background: #FFF3E0; padding: 20px; border-radius: 20px; border-left: 5px solid #FF8C42; margin: 20px 0; }}
                .button {{ background: #2ECC71; color: white; padding: 12px 25px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: bold; }}
                .footer {{ background: #f0f0f0; padding: 15px; text-align: center; color: #7F8C8D; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚀 ABC-ODE </h1>
                </div>
                <div class="content">
                    <h2>Hello {user_name}! 👋</h2>
                    <p>Thank you for reaching out to us. Here's the response from our support team:</p>
                    
                    <div class="reply-box">
                        <strong>📨 Admin Response:</strong>
                        <p style="margin-top: 10px;">{reply_message}</p>
                    </div>
                    
                    <p>If you have any more questions, feel free to submit another enquiry through our platform.</p>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="http://localhost:4200" class="button">🎮 Continue Coding</a>
                    </div>
                </div>
                <div class="footer">
                    <p>⭐ Keep coding and saving the galaxy! ⭐</p>
                    <p>&copy; 2024 ABC-ODE Space Academy</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Send email using fastapi-mail
        message = MessageSchema(
            subject="Response to your enquiry - ABC-ODE Support",
            recipients=[user_email],
            body=email_body,
            subtype="html"
        )
        
        fm = FastMail(email_config)
        await fm.send_message(message)
        
        print(f"✅ Email sent to {user_email}")
        
        return {
            "status": "success", 
            "data": response.data,
            "email_sent": True,
            "message": "Reply sent and email delivered successfully"
        }
        
    except Exception as e:
        print(f"Reply error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)