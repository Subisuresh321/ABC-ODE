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
    test_cases = payload.get("test_cases")  # This is now your list from the DB
    
    passed_count = 0
    total_tests = len(test_cases)
    results_log = []

    for test in test_cases:
        test_input = test["input"]
        expected_output = str(test["expected"])

        # 1. We wrap test_input in a list [] so unpacking '*' always works correctly
        # 2. We use a cleaner execution block
        full_code = f"""
{code}
try:
    args = [{test_input}]
    # Handle the case where the input itself is a single tuple/list
    if len(args) == 1 and isinstance(args[0], (list, tuple)) and 'solve' in globals():
        # This handles missions like The Tallest Stone [1,2,3]
        print(solve(args[0]))
    else:
        # This handles missions like Magic Adder (10, 5)
        print(solve(*args))
except Exception as e:
    print(f"PYTHON_ERROR: {{e}}")
"""
        try:
            container_output = client.containers.run(
                "python:3.12-slim",
                command=["python", "-c", full_code], # Passing as a list is safer for shell escaping
                remove=True,
                network_disabled=True,
                mem_limit="128m"
            )
            
            actual_output = container_output.decode("utf-8").strip()
            
            # Check if our internal try/except caught a Python error
            if "PYTHON_ERROR:" in actual_output:
                results_log.append({
                    "input": test_input, 
                    "passed": False, 
                    "error": actual_output.replace("PYTHON_ERROR: ", "")
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
            return {"status": "Error", "feedback": f"Sandbox error: {str(e)}"}

    # Final verdict
    is_perfect = (passed_count == total_tests)
    end_time = time.time() 
    execution_duration = end_time - start_time
    
    # Metaphor Logic
    if execution_duration < 0.2:
        metaphor = "🐆 Cheetah Speed! (Super Fast)"
    elif execution_duration < 0.5:
        metaphor = "🏃 Human Runner Speed! (Good)"
    else:
        metaphor = "🐌 Snail Pace! (A bit slow)"

    return {
        "status": "Success" if is_perfect else "Fail",
        "passed_tests": passed_count,
        "total_tests": total_tests,
        "results": results_log,
        "speed_metaphor": metaphor, # Send this to Angular
        "duration": round(execution_duration, 3)
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)