# Governing AI Agents: Visibility and Control
This is the repository for the LinkedIn Learning course `Governing AI Agents: Visibility and Control`. The full course is available from [LinkedIn Learning][lil-course-url].

![lil-thumbnail-url]

## Course Description

AI agents often look impressive in demos but struggle when they hit production, where you need visibility, safety controls, and clear accountability for every action an agent takes. In this hands-on course, Kesha Williams—a machine learning technology leader with 25+ years of experience—shows you how to work in Python to transform an ungoverned shopping agent into a governed system that behaves predictably in real-world environments.

Through hands-on coding in GitHub Codespaces, learn how to add structured logging to make agent behavior observable, implement runtime guardrails that block unsafe actions, and introduce human-in-the-loop approval workflows for high-risk changes. Kesha also demonstrates how to  build an agent inventory and a reusable deployment checklist that you can adapt to your own framework, giving you a practical governance tool kit—whether you are shipping your first agent feature or hardening an enterprise AI workflow.

_See the readme file in the main branch for updated instructions and information._

You’ll learn how to:
- Identify and document AI agents operating in a system using a structured agent inventory.
- Assess agent capabilities, permissions, and risk levels to establish visibility and accountability.
- Implement runtime guardrails that restrict agent actions and data access.
- Enforce governance controls directly in code rather than relying on documentation or policy alone.
- Apply agent governance patterns that translate across different agent frameworks and platforms.

## Notes
- This course, Governing AI Agents: Visibility and Control, is the first course in the governing AI agents series. The second course is [Operating AI Agents: Failure and Recovery](https://www.linkedin.com/learning/operating-ai-agents-failure-and-recovery/).


## Requirements
- Python 3.9+
- An [OpenAI API key](https://platform.openai.com/account/api-keys)

## Setup

1. **Clone this repo** (or download the files).
2. **Create and activate a virtual environment**:
    ```bash
    python -m venv venv
    source venv/bin/activate   # macOS/Linux
    venv\Scripts\activate      # Windows
    ```
3. **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
4. **Set your OpenAI API key or place in .env file**:
    ```bash
    export OPENAI_API_KEY="your_api_key"      # macOS/Linux
    setx OPENAI_API_KEY "your_api_key"        # Windows PowerShell
    ```

## Instructor

Kesha Williams

Award-Winning Tech Innovator and AI/ML Leader

[0]: # (Replace these placeholder URLs with actual course URLs)

[lil-course-url]: https://www.linkedin.com/learning/hands-on-ai-governing-ai-agents-in-practice
[lil-thumbnail-url]: https://media.licdn.com/dms/image/v2/D560DAQGI-Se3J10Zdg/learning-public-crop_675_1200/B56ZwAkgMdIoAY-/0/1769536095658?e=2147483647&v=beta&t=7krzOEasBq7uPRaRvO9Ux1_Lg9bmAQ5Nb9GYvO7SuKg
