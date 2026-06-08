import os
import uuid
import datetime
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import requests

load_dotenv(override=True)

from services.telegram_service import send_message as telegram_send
from services.whatsapp_service import send_message as whatsapp_send
from services.ai_service import process_inbound_message
from models import db, Message, Task

APP_ENV = os.getenv("APP_ENV", "development")

app = Flask(__name__)
# Configure database from environment, fallback to SQLite for local/demo use
if os.getenv("VERCEL"):
    app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:////tmp/jarvis.db"
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL", "sqlite:///jarvis.db")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {"connect_args": {"check_same_thread": False}}

db.init_app(app)

# Enable CORS so the Vite frontend (localhost:5173) can call the Flask API during development
CORS(app, resources={r"/api/*": {"origins": "*"}})

with app.app_context():
    db.create_all()

@app.route("/", methods=["GET"])
def index():
    pending_count = Message.query.filter_by(status='pending_approval').count()
    sent_count = Message.query.filter_by(status='sent').count()
    return jsonify({"pending_approval_count": pending_count, "sent_count": sent_count})

def normalize_platform(platform_value: str) -> str:
    if not platform_value:
        return "unknown"
    return platform_value.strip().lower()


def handle_inbound_background(message_id):
    """Background task to generate AI response and set status to pending_approval"""
    with app.app_context():
        msg = db.session.get(Message, message_id)
        if not msg:
            return
        
        msg.status = 'ai_processing'
        db.session.commit()

        try:
            ai_draft = process_inbound_message(msg.body, msg.platform, msg.sender)
            msg.response = ai_draft
            msg.status = 'pending_approval'
            
            # FUTURE VISION: Here we could trigger a push notification to the owner's app/phone 
            # to say "Jarvis drafted a reply to {msg.sender}. Approve?"
            
        except Exception as e:
            print(f"AI Processing error: {e}")
            msg.response = "I'm sorry, I could not generate the response automatically. Please retry later or review manually."
            msg.status = 'pending_approval'
        
        db.session.commit()

@app.route("/queue", methods=["POST"])
def queue_message():
    """Manually queue a message for sending (bypassing AI generation)"""
    payload = request.get_json(force=True)
    if not payload or "platform" not in payload or "to" not in payload or "body" not in payload:
        return jsonify({"error": "Invalid payload, require platform/to/body"}), 400

    platform = normalize_platform(payload["platform"])
    if platform not in ("telegram", "whatsapp"):
        return jsonify({"error": "Unsupported platform, must be telegram or whatsapp"}), 400

    msg = Message(
        platform=platform,
        sender=payload["to"],  # Target contact for outbound message
        body=payload["body"],
        is_inbound=False,
        status='pending_approval'
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify(msg.to_dict()), 201

@app.route("/pending", methods=["GET"])
def list_pending():
    """List all messages waiting for owner approval"""
    pending = Message.query.filter_by(status='pending_approval').all()
    return jsonify([p.to_dict() for p in pending])

@app.route("/approve", methods=["POST"])
def approve_and_send():
    """Owner approves an AI-drafted message to be sent"""
    payload = request.get_json(force=True)
    msg_id = payload.get("id")
    if not msg_id:
        return jsonify({"error": "Missing id"}), 400

    msg = db.session.get(Message, msg_id)
    if not msg:
        return jsonify({"error": "Message not found"}), 404
    
    if msg.status != 'pending_approval':
        return jsonify({"error": f"Message is not pending approval, current status is {msg.status}"}), 400

    try:
        send_text = msg.response or msg.body
        if msg.platform == "telegram":
            token = os.getenv("TELEGRAM_BOT_TOKEN")
            chat_id = msg.sender
            res = telegram_send(token, chat_id, send_text)
        elif msg.platform == "whatsapp":
            account_sid = os.getenv("TWILIO_ACCOUNT_SID")
            auth_token = os.getenv("TWILIO_AUTH_TOKEN")
            from_number = os.getenv("TWILIO_WHATSAPP_FROM")
            to_number = msg.sender
            res = whatsapp_send(account_sid, auth_token, from_number, to_number, send_text)
        else:
            return jsonify({"error": "Unsupported platform"}), 400

        msg.status = 'sent'
        msg.sent_at = datetime.datetime.utcnow()
        db.session.commit()
        return jsonify(msg.to_dict())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/webhook/telegram", methods=["POST"])
def webhook_telegram():
    data = request.get_json(force=True)
    message = data.get("message") or data
    
    sender_id = message.get("from", {}).get("id") if isinstance(message, dict) else None
    body = message.get("text") if isinstance(message, dict) else str(message)
    
    if not sender_id or not body:
         return jsonify({"ok": True, "note": "ignored empty/invalid message"})

    msg = Message(
        platform="telegram",
        sender=str(sender_id),
        body=body,
        is_inbound=True,
        status='received'
    )
    db.session.add(msg)
    db.session.commit()
    
    # Process AI in background so webhook returns 200 immediately
    thread = threading.Thread(
        target=handle_inbound_background,
        args=(msg.id,),
        daemon=True
    )
    thread.start()
    
    return jsonify({"ok": True})

@app.route("/webhook/whatsapp", methods=["POST"])
def webhook_whatsapp():
    data = request.form or request.get_json(silent=True) or {}
    from_number = data.get("From")
    body = data.get("Body")
    
    if not from_number or not body:
         return ("", 204)

    msg = Message(
        platform="whatsapp",
        sender=from_number,
        body=body,
        is_inbound=True,
        status='received'
    )
    db.session.add(msg)
    db.session.commit()
    
    thread = threading.Thread(
        target=handle_inbound_background,
        args=(msg.id,),
        daemon=True
    )
    thread.start()
    
    return ("", 204)


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    tasks = Task.query.all()
    return jsonify({"tasks": [t.to_dict() for t in tasks]})

@app.route("/api/tasks", methods=["POST"])
def create_task():
    payload = request.get_json(force=True) or {}
    title = payload.get("title")
    status = payload.get("status", "todo")
    if not title or not isinstance(title, str):
        return jsonify({"error": "Task title is required."}), 400

    task = Task(title=title.strip(), status=status)
    db.session.add(task)
    db.session.commit()
    return jsonify({"task": task.to_dict()}), 201

@app.route("/api/tasks/<task_id>", methods=["DELETE"])
def delete_task(task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found."}), 404
    db.session.delete(task)
    db.session.commit()
    return jsonify({"success": True})


@app.route('/api/jarves', methods=['POST'])
def api_jarves():
    """Proxy endpoint used by the Jarves frontend to call different AI providers.
    Expects JSON body with: { message, provider, model, systemPrompt, geminiApiKey (optional) }
    """
    payload = request.get_json(force=True) or {}
    message = payload.get('message') or payload.get('text') or ''
    provider = (payload.get('provider') or 'openrouter').lower()
    model = payload.get('model') or ''
    systemPrompt = payload.get('systemPrompt') or ''

    use_server_key = True
    # If frontend explicitly passes useServerKey false, allow client key (dev only)
    if isinstance(payload.get('useServerKey'), bool):
        use_server_key = payload.get('useServerKey')

    try:
        if provider == 'openrouter':
            api_key = os.getenv('OPENROUTER_API_KEY') if use_server_key else payload.get('openrouterApiKey')
            if not api_key:
                return jsonify({'error': 'Server missing OpenRouter API key'}), 500
            body = {
                'model': model or os.getenv('OPENROUTER_DEFAULT_MODEL', 'deepseek/deepseek-r1:free'),
                'messages': [{ 'role': 'system', 'content': systemPrompt }] if systemPrompt else [],
                'max_tokens': 2048,
            }
            # If history style message is provided, accept it
            if payload.get('history'):
                body['messages'] = payload.get('history')
            else:
                body['messages'] = ( [{ 'role': 'system', 'content': systemPrompt }] if systemPrompt else [] ) + [{ 'role': 'user', 'content': message }]

            resp = requests.post('https://openrouter.ai/api/v1/chat/completions', json=body, headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'})
            raw = resp.text
            if not resp.ok:
                # Try parse JSON error
                try:
                    err = resp.json()
                    return jsonify({'error': err}), 500
                except Exception:
                    return jsonify({'error': f'OpenRouter error: {resp.status_code}', 'raw': raw}), 500
            data = resp.json()
            reply = data.get('choices', [{}])[0].get('message', {}).get('content', '')
            return jsonify({'reply': reply, 'raw': data})

        elif provider == 'gemini':
            api_key = os.getenv('GEMINI_API_KEY') if use_server_key else payload.get('geminiApiKey')
            if not api_key:
                return jsonify({'error': 'Server missing GEMINI_API_KEY (set GEMINI_API_KEY env)'}), 500
            # Use Google Generative Language endpoint (best-effort shape)
            model_id = model or 'models/gemini-1.5-preview'
            url = f'https://generativelanguage.googleapis.com/v1beta2/{model_id}:generate'
            prompt_text = (systemPrompt + '\n\n' if systemPrompt else '') + message
            body = {
                'prompt': { 'text': prompt_text },
                'temperature': 0.2,
            }
            headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'}
            resp = requests.post(url, json=body, headers=headers, timeout=30)
            raw = resp.text
            if not resp.ok:
                try:
                    return jsonify({'error': resp.json()}), 500
                except Exception:
                    return jsonify({'error': f'Gemini error: {resp.status_code}', 'raw': raw}), 500
            data = resp.json()
            # Parse common response shapes
            reply = ''
            if isinstance(data, dict):
                # Try candidates -> output or candidates[0].content
                if 'candidates' in data and isinstance(data['candidates'], list) and data['candidates']:
                    first = data['candidates'][0]
                    if isinstance(first, dict):
                        reply = first.get('output', '') or first.get('content', '') or ''
                if not reply and 'output' in data:
                    # Some variants have output.text
                    out = data.get('output')
                    if isinstance(out, dict):
                        reply = out.get('text', '')
                if not reply:
                    # Fallback: join string values
                    for v in ('candidates', 'output', 'reply'):
                        if v in data and isinstance(data[v], str):
                            reply = data[v]
            return jsonify({'reply': reply, 'raw': data})

        elif provider == 'openai':
            api_key = os.getenv('OPENAI_API_KEY') if use_server_key else payload.get('openaiApiKey')
            if not api_key:
                return jsonify({'error': 'Server missing OPENAI_API_KEY'}), 500
            url = 'https://api.openai.com/v1/chat/completions'
            body = {
                'model': model or 'gpt-4o',
                'messages': [{ 'role': 'system', 'content': systemPrompt }] if systemPrompt else []
            }
            if payload.get('history'):
                body['messages'] = payload.get('history')
            else:
                body['messages'] = ( [{ 'role': 'system', 'content': systemPrompt }] if systemPrompt else [] ) + [{ 'role': 'user', 'content': message }]
            resp = requests.post(url, json=body, headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, timeout=30)
            raw = resp.text
            if not resp.ok:
                try:
                    return jsonify({'error': resp.json()}), 500
                except Exception:
                    return jsonify({'error': f'OpenAI error: {resp.status_code}', 'raw': raw}), 500
            data = resp.json()
            reply = data.get('choices', [{}])[0].get('message', {}).get('content', '')
            return jsonify({'reply': reply, 'raw': data})

        else:
            return jsonify({'error': f'Unsupported provider: {provider}'}), 400

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=(APP_ENV != "production"))
