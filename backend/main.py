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

# Allow your Angular frontend to talk to this backend
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

    for test in test_cases:
        test_input = test["input"]
        expected_output = str(test["expected"])

        full_code = f"""
{code}
import inspect
import ast

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
    
    if result is not None:
        print(result)
    else:
        print("None")
except Exception as e:
    print(f"Error: {{e}}")
"""

        try:
            container_output = client.containers.run(
                "python:3.12-slim",
                command=["python", "-c", full_code],
                remove=True,
                network_disabled=True,
                mem_limit="128m"
            )
            
            actual_output = container_output.decode("utf-8").strip()
            print(f"Input: {test_input}, Expected: {expected_output}, Got: '{actual_output}'")
            
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
            results_log.append({"input": test_input, "passed": False, "error": str(e)})

    is_perfect = (passed_count == total_tests)
    execution_duration = round(time.time() - start_time, 3)
    
    if execution_duration < 0.2:
        metaphor = "Cheetah"
    elif execution_duration < 0.5:
        metaphor = "Human"
    else:
        metaphor = "Snail"

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
        "duration": execution_duration
    }


@app.get("/missions")
async def get_all_missions():
    response = supabase.table("problems").select("id", "title", "difficulty", "category").execute()
    return response.data


@app.post("/add-xp")
async def add_xp(payload: dict = Body(...)):
    user_id = payload.get("user_id")
    xp_to_add = payload.get("xp_to_add")
    
    user = supabase.table("profiles").select("xp_points").eq("id", user_id).single().execute()
    new_xp = (user.data['xp_points'] or 0) + xp_to_add
    
    supabase.table("profiles").update({"xp_points": new_xp}).eq("id", user_id).execute()
    
    return {"status": "success", "new_xp": new_xp}


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
            "hints": []
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)