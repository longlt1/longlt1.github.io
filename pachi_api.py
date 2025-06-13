import subprocess
import psutil
import os
from flask_cors import CORS
from flask import Flask, request, jsonify

app = Flask(__name__)
CORS(app)

# Use a single global Pachi process
pachi_process = None

def get_pachi_config(rank):
    """Get Pachi configuration based on rank"""
    configs = {
        'beginner': {
            'max_games': 10,
            'max_tree_size': 100,
            'max_playouts': 100,
            # 'time': 20,        # Thời gian suy nghĩ tối đa (giây)
            # 'quick': True,    # Chế độ nhanh
            # 'nopass': True,   # Không cho phép pass
            # 'ladder': 1,      # Mức độ xử lý ladder
            # 'komi': 6.5       # Điểm komi cho quân trắng
        },
        'intermediate': {
            'max_games': 1000,
            'max_tree_size': 10000,
            'max_playouts': 10000,
            # 'time': 10,       # Thời gian suy nghĩ tối đa (giây)
            # 'quick': False,   # Chế độ bình thường
            # 'nopass': True,   # Không cho phép pass
            # 'ladder': 2,      # Mức độ xử lý ladder
            # 'komi': 6.5       # Điểm komi cho quân trắng
        },
        'pro': {
            'max_games': 10000,
            'max_tree_size': 100000,
            'max_playouts': 100000,
            # 'time': 30,       # Thời gian suy nghĩ tối đa (giây)
            # 'quick': False,   # Chế độ bình thường
            # 'nopass': True,   # Không cho phép pass
            # 'ladder': 3,      # Mức độ xử lý ladder
            # 'komi': 6.5       # Điểm komi cho quân trắng
        }
    }
    return configs.get(rank, configs['intermediate'])

def start_pachi(rank='intermediate'):
    # Start Pachi with default configuration (no extra flags)
    cmd = ['./pachi', '--gtp']
    return subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        bufsize=1
    )

def get_or_create_pachi(rank='intermediate'):
    global pachi_process
    if pachi_process is None or pachi_process.poll() is not None:
        print(f"(Re)starting global Pachi instance with rank {rank}")
        pachi_process = start_pachi(rank)
    return pachi_process

def send_gtp_command(cmd, rank='intermediate'):
    """Send GTP command to specific Pachi instance"""
    pachi = get_or_create_pachi(rank)
    try:
        pachi.stdin.write(cmd + '\n')
        pachi.stdin.flush()
        response_lines = []
        while True:
            line = pachi.stdout.readline()
            if not line:
                break  # EOF or process died
            line = line.strip()
            if line.startswith('=') or line.startswith('?'):
                # GTP response found
                # Remove the '=' or '?' and any leading space
                response = line[1:].strip()
                response_lines.append(response)
                break
            elif line != '':
                response_lines.append(line)
        return '\n'.join(response_lines)
    except (BrokenPipeError, IOError):
        print(f"Restarting global Pachi instance due to error")
        global pachi_process
        pachi_process = start_pachi(rank)
        return send_gtp_command(cmd, rank)

def send_multiple_commands(commands, rank='intermediate'):
    """Send multiple GTP commands to specific Pachi instance"""
    responses = {}
    for cmd in commands:
        response = send_gtp_command(cmd, rank)
        responses[cmd] = response
    return responses

@app.route('/batch', methods=['POST'])
def batch_commands():
    commands = request.json.get('commands', [])
    rank = request.json.get('rank', 'intermediate')
    if not commands:
        return jsonify({'error': 'No commands provided'}), 400
    print(f"Processing batch commands with rank {rank}")
    responses = send_multiple_commands(commands, rank)
    return jsonify({'responses': responses})

@app.route('/genmove', methods=['POST'])
def genmove():
    color = request.json.get('color', 'b')
    rank = request.json.get('rank', 'intermediate')
    response = send_gtp_command(f'genmove {color}', rank)
    return jsonify({'response': response})

@app.route('/play', methods=['POST'])
def play():
    color = request.json.get('color')
    vertex = request.json.get('vertex')
    rank = request.json.get('rank', 'intermediate')
    response = send_gtp_command(f'play {color} {vertex}', rank)
    return jsonify({'response': response})

@app.route('/boardsize', methods=['POST'])
def boardsize():
    size = request.json.get('size', 19)
    rank = request.json.get('rank', 'intermediate')
    response = send_gtp_command(f'boardsize {size}', rank)
    return jsonify({'response': response})

@app.route('/clear', methods=['POST'])
def clear_board():
    rank = request.json.get('rank', 'intermediate')
    response = send_gtp_command('clear_board', rank)
    return jsonify({'response': response})

@app.route('/quit', methods=['POST'])
def quit_pachi():
    global pachi_process
    if pachi_process is not None:
        send_gtp_command('quit')
        pachi_process = None
    return jsonify({'status': 'Pachi quit'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, ssl_context=('cert.pem', 'key.pem'))
