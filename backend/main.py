from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
from dotenv import load_dotenv
import docker
import json,time
from fastapi import Body

# --- SETUP ---
load_dotenv()  # This loads the variables from .env

URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_KEY")

if not URL or not KEY:
    print("❌ Error: Supabase credentials not found in .env file")

supabase: Client = create_client(URL, KEY)

client = docker.from_env()

app = FastAPI()

# Allow your Angular frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/mission/{mission_id}")  # <--- Added {mission_id}
async def get_mission(mission_id: str): # <--- Added mission_id as an argument
    try:
        response = supabase.table("problems").select("*").eq("id", mission_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Mission not found in the vault!")
            
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/run")
async def run_code(payload: dict = Body(...)):
    start_time = time.time()
    code = payload.get("code")
    test_cases = payload.get("test_cases")
    user_id = payload.get("user_id")      # Captured from payload
    problem_id = payload.get("problem_id") # Captured from payload
    
    passed_count = 0
    total_tests = len(test_cases)
    results_log = []

    for test in test_cases:
        test_input = test["input"]
        expected_output = str(test["expected"])

        full_code = f"""
{code}
try:
    args = [{test_input}]
    if len(args) == 1 and isinstance(args[0], (list, tuple)) and 'solve' in globals():
        print(solve(args[0]))
    else:
        print(solve(*args))
except Exception as e:
    print(f"PYTHON_ERROR: {{e}}")
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
            
            if "PYTHON_ERROR:" in actual_output:
                results_log.append({"input": test_input, "passed": False, "error": actual_output})
                continue 

            if actual_output == expected_output:
                passed_count += 1
                results_log.append({"input": test_input, "passed": True})
            else:
                results_log.append({"input": test_input, "passed": False, "actual": actual_output, "expected": expected_output})
        except Exception as e:
            return {"status": "Error", "feedback": f"Sandbox error: {str(e)}"}

    is_perfect = (passed_count == total_tests)
    execution_duration = round(time.time() - start_time, 3)
    
    # Metaphor Logic
    if execution_duration < 0.2:
        metaphor = "Cheetah"
    elif execution_duration < 0.5:
        metaphor = "Human"
    else:
        metaphor = "Snail"

    # --- NEW: SAVE TO DATABASE ---
    try:
        # Build the data object
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
        
        # Log it for debugging
        print(f"🚀 Attempting DB Insert for User {user_id}")
        
        supabase.table("submissions").insert(log_entry).execute()
        print("✅ SUCCESS: Added to Submissions table")
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
    # Fetch all missions but only the basic info to keep it fast
    response = supabase.table("problems").select("id", "title", "difficulty", "category").execute()
    return response.data

@app.post("/add-xp")
async def add_xp(payload: dict = Body(...)):
    user_id = payload.get("user_id")
    xp_to_add = payload.get("xp_to_add")
    
    # 1. Get current XP
    user = supabase.table("profiles").select("xp_points").eq("id", user_id).single().execute()
    new_xp = (user.data['xp_points'] or 0) + xp_to_add
    
    # 2. Update the profile
    supabase.table("profiles").update({"xp_points": new_xp}).eq("id", user_id).execute()
    
    return {"status": "success", "new_xp": new_xp}


@app.get("/profile/{user_id}")
async def get_profile(user_id: str):
    try:
        response = supabase.table("profiles").select("hero_name").eq("id", user_id).single().execute()
        return response.data
    except Exception as e:
        return {"hero_name": "Commander"} # Fallback if not found
    
@app.get("/user-profile/{user_id}")
async def get_public_profile(user_id: str):
    try:
        # Fetch profile using columns we KNOW exist in your screenshot
        profile_res = supabase.table("profiles") \
            .select("hero_name, xp_points, updated_at") \
            .eq("id", user_id) \
            .execute()
        
        if not profile_res.data:
            print(f"ID {user_id} not found in Profiles table")
            raise HTTPException(status_code=404, detail="Hero not found!")

        # Fetch submissions
        subs_res = supabase.table("latest_user_submissions") \
            .select("*, problems(title, category, difficulty)") \
            .eq("user_id", user_id) \
            .execute()
            
        return {
            "identity": profile_res.data[0],
            "submissions": subs_res.data or []
        }
    except Exception as e:
        print(f"DATABASE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/leaderboard")
async def get_leaderboard():
    try:
        # We MUST include "id" here so the frontend can link to the profile!
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
            "xp_reward": int(payload.get("xp_reward", 0)), # Ensure this is an integer
            "hints": [] # Explicitly send an empty list for hints
        }).execute()
        
        return {"status": "success", "data": response.data}
    except Exception as e:
        # Check your terminal! This will tell you EXACTLY which column or value failed.
        print("--- DATABASE ERROR ---")
        print(e) 
        print("-----------------------")
        raise HTTPException(status_code=500, detail=str(e))
    
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)