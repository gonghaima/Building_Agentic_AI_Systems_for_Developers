"""LLM-as-a-Judge: contract key-term extraction and evaluation.

Rewritten from LLM_As_A_Judge.ipynb to run as a standalone script using
a local Ollama model instead of a direct OpenAI API key. Ollama exposes
an OpenAI-compatible API, so the existing `openai` client works
unchanged aside from pointing `base_url` at Ollama and using Ollama's
local model name. No tool/function calling is used anywhere in this
script, so local-model reliability isn't a concern the way it can be
for agentic tool-calling flows.
"""

import gradio as gr
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader
from openai import OpenAI
import pandas as pd
import os
import json
import re
import tempfile

OLLAMA_MODEL = "llama3.1:8b"
EXTRACTION_MODEL = OLLAMA_MODEL
JUDGE_MODEL = OLLAMA_MODEL

client = OpenAI(api_key="ollama", base_url="http://localhost:11434/v1")
try:
    client.models.list()
    print("✅ Ollama server is reachable.")
except Exception as e:
    raise RuntimeError(f"Ollama server check failed (is `ollama serve` running?): {e}")

KEY_TERMS = [
    "Product Name",
    "Limitation of Liability In Months",
    "Governing Law",
]

EVALUATION_METRICS = [
    "Was the information extracted as per the question asked in the key term?",
    "Was the information complete?",
    "Was the information enough to make a conclusive decision?",
    "Was the AI reasoning discussing the relevant clause?",
    "Does the information stay within document scope?",
    "Were results free from misleading claims?",
    "Does the tool avoid generic/non-contract answers?",
    "Did the tool prevent false claims about people/entities?",
]


def extract_text_from_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        docs = PyPDFLoader(file_path).load()
        text = "\n".join(doc.page_content for doc in docs)
    elif ext in (".docx", ".doc"):
        docs = Docx2txtLoader(file_path).load()
        text = "\n".join(doc.page_content for doc in docs)
    elif ext == ".txt":
        docs = TextLoader(file_path).load()
        text = "\n".join(doc.page_content for doc in docs)
    elif ext == ".csv":
        df = pd.read_csv(file_path)
        text = df.to_string(index=False)
        docs = [type("Doc", (object,), {"page_content": text})()]
    else:
        raise ValueError("Unsupported file type")

    return text, docs


def _safe_json_parse(response_text):
    try:
        return json.loads(response_text.strip())
    except json.JSONDecodeError:
        pass

    for pattern in (r"```json\s*(.*?)\s*```", r"```\s*(.*?)\s*```", r"\{.*\}"):
        match = re.search(pattern, response_text, re.DOTALL)
        if match:
            candidate = match.group(1) if "json" in pattern else match.group(0)
            try:
                return json.loads(candidate.strip())
            except json.JSONDecodeError:
                continue

    return {"Value": "Not found", "Page Number": None, "Section": None}


def extract_key_terms(text, key_terms):
    results = {}
    for term in key_terms:
        prompt = (
            f"Act as a legal expert. From this contract text, extract the value for '{term}'.\n\n"
            f"Contract Text: {text}\n\n"
            f"Instructions:\n"
            f"1. Provide a one-word answer for '{term}' if found\n"
            f"2. Include page number if available\n"
            f"3. If not found, use 'Not found'\n\n"
            f"Return ONLY valid JSON in this exact format:\n"
            f'{{"Value": "your_answer", "Page Number": "page_number_or_null", "Section": "section_name"}}'
        )

        try:
            completion = client.chat.completions.create(
                model=EXTRACTION_MODEL,
                messages=[
                    {"role": "system", "content": "You are a legal contract analysis assistant. Always return valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=512,
            )
            answer = completion.choices[0].message.content
            parsed = _safe_json_parse(answer)

            value = parsed.get("Value", "Not found")
            page_number = (
                parsed.get("Page Number")
                or parsed.get("PageNumber")
                or parsed.get("page_number")
            )
            if not page_number:
                section = str(parsed.get("Section", ""))
                page_match = re.search(r"Page (\d+)", section)
                if page_match:
                    page_number = page_match.group(1)

        except Exception as e:
            print(f"extract_key_terms: API call failed for '{term}': {e}")
            value = "Error"
            page_number = None

        results[term] = {"Value": value, "page_number": page_number}

    return results


def judge_llm(key_terms, extract_key_terms_response, metrics):
    results = []

    for term in key_terms:
        llm_answer = extract_key_terms_response.get(term, {}).get("Value", "Not found")
        page_number = extract_key_terms_response.get(term, {}).get("page_number", None)

        for metric in metrics:
            prompt = (
                f"You are an expert contract lawyer. Evaluate the extracted answer for the key term '{term}' using the evaluation metrics provided.\n\n"
                f"KEY TERM: {term}\n"
                f"EVALUATION METRICS:\n{metrics}\n\n"
                f"EXTRACTED ANSWER:\n{llm_answer}\n\n"
                "INSTRUCTIONS:\n"
                "- Check if the answer clearly addresses the key term and meets the evaluation metrics.\n"
                "- Assign a score from 0 to 5 using the criteria below:\n\n"
                "- Provide a short justification why you score this metric a particular score.\n"
                "SCORING GUIDE:\n"
                "Score 0 : Key term not addressed at all.\n"
                "Score 1 : Answer is irrelevant or empty.\n"
                "Score 2 : Some relevant info, but fails to meet metrics or is incomplete.\n"
                "Score 3 : Adequate answer, meets around half of the metrics with acceptable accuracy.\n"
                "Score 4 : Strong answer, meets most metrics with good clarity and detail.\n"
                "Score 5 : Excellent answer, complete, accurate, and meets nearly all metrics with clear legal context.\n\n"
                "RESPONSE FORMAT:\n"
                "Score: <number>\n"
                "Justification: <text>\n"
            )

            completion = client.chat.completions.create(
                model=JUDGE_MODEL,
                messages=[
                    {"role": "system", "content": "You are a contract evaluation expert."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=512,
            )
            content = completion.choices[0].message.content

            score_match = re.search(r"Score:\s*(\d+)", content)
            score = int(score_match.group(1)) if score_match else None

            justification_match = re.search(r"Justification:\s*(.*)", content, re.DOTALL)
            justification = justification_match.group(1).strip() if justification_match else content

            pass_fail = score is not None and score >= 3

            results.append({
                "key_term_name": term,
                "llm_extracted_ans_from_doc": llm_answer,
                "page_number": page_number,
                "evulation_metric_name": metric,
                "LLM_Judge_Response": pass_fail,
                "justification": justification,
            })

    return results


def process_documents_with_progress(contract_file, progress=gr.Progress()):
    progress(0.1, desc="📄 Extracting text from contract file...")
    text, docs = extract_text_from_file(contract_file)
    progress(0.2, desc="✅ Text extraction completed")

    progress(0.3, desc="🔍 Extracting key terms from contract...")
    key_term_results = extract_key_terms(text, KEY_TERMS)
    progress(0.5, desc="✅ Key terms extraction completed")

    progress(0.6, desc="⚖️ Evaluating key terms with LLM judge...")
    evals = judge_llm(KEY_TERMS, key_term_results, EVALUATION_METRICS)
    progress(0.8, desc="✅ Evaluation completed")

    progress(0.9, desc="📊 Formatting results for display...")
    for e in evals:
        llm_ans = e["llm_extracted_ans_from_doc"]
        if llm_ans:
            text_match = re.search(r"Text:\s*(.*)", llm_ans, re.DOTALL)
            e["llm_extracted_ans_from_doc"] = text_match.group(1).strip() if text_match else llm_ans

    df = pd.DataFrame(evals)
    display_cols = [
        "key_term_name",
        "llm_extracted_ans_from_doc",
        "page_number",
        "evulation_metric_name",
        "LLM_Judge_Response",
        "justification",
    ]
    df = df[display_cols]

    metric_groups = [EVALUATION_METRICS[:3], EVALUATION_METRICS[3:6], EVALUATION_METRICS[6:8]]
    df1 = df[df["evulation_metric_name"].isin(metric_groups[0])].reset_index(drop=True)
    df2 = df[df["evulation_metric_name"].isin(metric_groups[1])].reset_index(drop=True)
    df3 = df[df["evulation_metric_name"].isin(metric_groups[2])].reset_index(drop=True)

    progress(1.0, desc="🎉 Processing completed successfully!")

    return text, df1, df2, df3, df


with gr.Blocks() as demo:
    gr.Markdown("# 📄 LLM Contract Judge\nUpload a contract, extract key terms, and evaluate with LLM.")

    with gr.Row():
        contract_file = gr.File(label="Upload Contract (PDF, DOCX, TXT)")

    start_btn = gr.Button("🚀 Start Evaluating", variant="primary")

    progress_text = gr.Textbox(
        label="Processing Status",
        value="Ready to start evaluation...",
        interactive=False,
    )

    extracted_text = gr.Textbox(label="Extracted Contract Text", lines=10, interactive=False)

    result_headers = [
        "key_term_name",
        "llm_extracted_ans_from_doc",
        "page_number",
        "evulation_metric_name",
        "LLM_Judge_Response",
        "justification",
    ]

    with gr.Tabs():
        with gr.TabItem("Helpful Metrics"):
            results_table1 = gr.Dataframe(headers=result_headers, label="Evaluation Results (Helpful Metrics)")
        with gr.TabItem("Honest Metrics"):
            results_table2 = gr.Dataframe(headers=result_headers, label="Evaluation Results (Honest Metrics)")
        with gr.TabItem("Harmless Metrics"):
            results_table3 = gr.Dataframe(headers=result_headers, label="Evaluation Results (Harmless Metrics)")

    download_btn = gr.Button("📥 Download All Results as CSV")
    download_file = gr.File(label="Download CSV")

    state_df1 = gr.State()
    state_df2 = gr.State()
    state_df3 = gr.State()
    state_df_all = gr.State()

    def run_and_return_tables(contract_file, progress=gr.Progress()):
        if not contract_file:
            return (
                "Please upload a contract file first.",
                gr.update(value=None),
                gr.update(value=None),
                gr.update(value=None),
                None, None, None, None,
            )

        try:
            text, df1, df2, df3, df_all = process_documents_with_progress(contract_file, progress)
            return (
                text,
                gr.update(value=df1),
                gr.update(value=df2),
                gr.update(value=df3),
                df1, df2, df3, df_all,
            )
        except Exception as e:
            error_msg = f"❌ Error during processing: {str(e)}"
            return (
                error_msg,
                gr.update(value=None),
                gr.update(value=None),
                gr.update(value=None),
                None, None, None, None,
            )

    def download_csv(contract_file, df_all):
        if df_all is None:
            return None

        try:
            required_cols = [
                "key_term_name",
                "llm_extracted_ans_from_doc",
                "page_number",
                "evulation_metric_name",
                "LLM_Judge_Response",
                "justification",
            ]
            df_filtered = df_all[required_cols].copy()
            # pivot_table/groupby drop rows whose index keys are NaN, which
            # silently loses key terms with a missing page number.
            df_filtered["page_number"] = df_filtered["page_number"].fillna("N/A")

            pivot_df = df_filtered.pivot_table(
                index=["key_term_name", "llm_extracted_ans_from_doc", "page_number"],
                columns="evulation_metric_name",
                values="LLM_Judge_Response",
                aggfunc="first",
            ).reset_index()
            pivot_df.columns.name = None
            pivot_df = pivot_df.rename(columns={
                "key_term_name": "key_term_name",
                "llm_extracted_ans_from_doc": "value",
                "page_number": "page_number",
            })

            justification_df = df_filtered.groupby(
                ["key_term_name", "llm_extracted_ans_from_doc", "page_number"]
            )["justification"].apply(lambda x: " | ".join(x.dropna().unique())).reset_index()

            final_df = pivot_df.merge(
                justification_df,
                left_on=["key_term_name", "value", "page_number"],
                right_on=["key_term_name", "llm_extracted_ans_from_doc", "page_number"],
                how="left",
            )
            if "llm_extracted_ans_from_doc" in final_df.columns:
                final_df = final_df.drop("llm_extracted_ans_from_doc", axis=1)

            basic_cols = ["key_term_name", "value", "page_number"]
            metric_cols = [c for c in final_df.columns if c not in basic_cols + ["justification"]]
            final_df = final_df[basic_cols + metric_cols + ["justification"]]

            with tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="w", encoding="utf-8") as tmp:
                final_df.to_csv(tmp, index=False)
                tmp_path = tmp.name

            return tmp_path

        except Exception as e:
            print(f"Error in download_csv: {str(e)}")
            return None

    start_btn.click(
        run_and_return_tables,
        inputs=[contract_file],
        outputs=[extracted_text, results_table1, results_table2, results_table3, state_df1, state_df2, state_df3, state_df_all],
    )

    download_btn.click(
        download_csv,
        inputs=[contract_file, state_df_all],
        outputs=download_file,
    )

if __name__ == "__main__":
    demo.launch()
