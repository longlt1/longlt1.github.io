import subprocess
import psutil
import os
from flask_cors import CORS
from flask import Flask, request, jsonify

app = Flask(__name__)
CORS(app)

# Store Pachi processes by gameId
pachi_processes = {}

def get_pachi_config(rank):
    """Get Pachi configuration based on rank"""
    configs = {
        'beginner': {
            'max_games': 100,
            'max_tree_size': 1000,
            'max_playouts': 1000,
            'time': 20,        # Thời gian suy nghĩ tối đa (giây)
            'quick': True,    # Chế độ nhanh
            'nopass': True,   # Không cho phép pass
            'ladder': 1,      # Mức độ xử lý ladder
            'komi': 6.5       # Điểm komi cho quân trắng
        },
        'intermediate': {
            'max_games': 1000,
            'max_tree_size': 10000,
            'max_playouts': 10000,
            'time': 10,       # Thời gian suy nghĩ tối đa (giây)
            'quick': False,   # Chế độ bình thường
            'nopass': True,   # Không cho phép pass
            'ladder': 2,      # Mức độ xử lý ladder
            'komi': 6.5       # Điểm komi cho quân trắng
        },
        'pro': {
            'max_games': 10000,
            'max_tree_size': 100000,
            'max_playouts': 100000,
            'time': 30,       # Thời gian suy nghĩ tối đa (giây)
            'quick': False,   # Chế độ bình thường
            'nopass': True,   # Không cho phép pass
            'ladder': 3,      # Mức độ xử lý ladder
            'komi': 6.5       # Điểm komi cho quân trắng
        }
    }
    return configs.get(rank, configs['intermediate'])

def start_pachi(rank='intermediate'):
    """Start new Pachi process with specific rank configuration"""
    config = get_pachi_config(rank)
    cmd = [
        './pachi',
        '--gtp',
        f'--max-games={config["max_games"]}',
        f'--max-tree-size={config["max_tree_size"]}',
        f'--max-playouts={config["max_playouts"]}',
        f'--time={config["time"]}',
        '--quick' if config["quick"] else '',
        '--nopass' if config["nopass"] else '',
        f'--ladder={config["ladder"]}',
        f'--komi={config["komi"]}'
    ]
    # Lọc bỏ các tham số rỗng
    cmd = [arg for arg in cmd if arg]
    return subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        bufsize=1
    )

def get_or_create_pachi(gameId, rank='intermediate'):
    """Get existing Pachi process or create new one for gameId"""
    if gameId not in pachi_processes:
        print(f"Creating new Pachi instance for game {gameId} with rank {rank}")
        pachi_processes[gameId] = start_pachi(rank)
    return pachi_processes[gameId]

def send_gtp_command(cmd, gameId, rank='intermediate'):
    """Send GTP command to specific Pachi instance"""
    pachi = get_or_create_pachi(gameId, rank)
    try:
        pachi.stdin.write(cmd + '\n')
        pachi.stdin.flush()
        output = []
        while True:
            line = pachi.stdout.readline()
            if line.strip() == "":
                break
            output.append(line.strip())
        return '\n'.join(output)
    except (BrokenPipeError, IOError):
        # If process died, restart it
        print(f"Restarting Pachi instance for game {gameId}")
        pachi_processes[gameId] = start_pachi(rank)
        return send_gtp_command(cmd, gameId, rank)  # Retry the command

def send_multiple_commands(commands, gameId, rank='intermediate'):
    """Send multiple GTP commands to specific Pachi instance"""
    responses = {}
    for cmd in commands:
        response = send_gtp_command(cmd, gameId, rank)
        responses[cmd] = response
    return responses

@app.route('/batch', methods=['POST'])
def batch_commands():
    commands = request.json.get('commands', [])
    gameId = request.json.get('gameId')
    rank = request.json.get('rank', 'intermediate')
    
    if not commands:
        return jsonify({'error': 'No commands provided'}), 400
    if not gameId:
        return jsonify({'error': 'No gameId provided'}), 400
    
    print(f"Processing batch commands for game {gameId} with rank {rank}")
    responses = send_multiple_commands(commands, gameId, rank)
    return jsonify({'responses': responses})

@app.route('/genmove', methods=['POST'])
def genmove():
    color = request.json.get('color', 'b')
    gameId = request.json.get('gameId')
    rank = request.json.get('rank', 'intermediate')
    
    if not gameId:
        return jsonify({'error': 'No gameId provided'}), 400
        
    response = send_gtp_command(f'genmove {color}', gameId, rank)
    return jsonify({'response': response})

@app.route('/play', methods=['POST'])
def play():
    color = request.json.get('color')
    vertex = request.json.get('vertex')
    gameId = request.json.get('gameId')
    rank = request.json.get('rank', 'intermediate')
    
    if not gameId:
        return jsonify({'error': 'No gameId provided'}), 400
        
    response = send_gtp_command(f'play {color} {vertex}', gameId, rank)
    return jsonify({'response': response})

@app.route('/boardsize', methods=['POST'])
def boardsize():
    size = request.json.get('size', 19)
    gameId = request.json.get('gameId')
    rank = request.json.get('rank', 'intermediate')
    
    if not gameId:
        return jsonify({'error': 'No gameId provided'}), 400
        
    response = send_gtp_command(f'boardsize {size}', gameId, rank)
    return jsonify({'response': response})

@app.route('/clear', methods=['POST'])
def clear_board():
    gameId = request.json.get('gameId')
    rank = request.json.get('rank', 'intermediate')
    
    if not gameId:
        return jsonify({'error': 'No gameId provided'}), 400
        
    response = send_gtp_command('clear_board', gameId, rank)
    return jsonify({'response': response})

@app.route('/quit', methods=['POST'])
def quit_pachi():
    gameId = request.json.get('gameId')
    if not gameId:
        return jsonify({'error': 'No gameId provided'}), 400
        
    if gameId in pachi_processes:
        send_gtp_command('quit', gameId)
        del pachi_processes[gameId]
    return jsonify({'status': f'Pachi quit for game {gameId}'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, ssl_context=('cert.pem', 'key.pem'))
