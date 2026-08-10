import json

def save_to_crm(feedback_text: str, sentiment: str, category: str, customer_tier: str):
    log_entry = {
        "text": feedback_text,
        "sentiment": sentiment,
        "category": category,
        "customer_tier": customer_tier
    }
    try:
        with open("crm_demo_log.txt", "a") as f:
            f.write(json.dumps(log_entry) + "\n")
        return f"Log entry created successfully: {json.dumps(log_entry)}"
    except Exception as e:
        return f"Failed to write to CRM log: {str(e)}"
