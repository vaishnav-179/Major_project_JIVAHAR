# Jivahar Database Seeder Entrypoint
import os
import sys

scripts_dir = os.path.join(os.path.dirname(__file__), 'scripts')
seed_file = os.path.join(scripts_dir, 'seed_db.py')

if __name__ == '__main__':
    if os.path.exists(seed_file):
        with open(seed_file, 'r', encoding='utf-8') as f:
            exec(f.read())
    else:
        print("Error: scripts/seed_db.py not found.")
