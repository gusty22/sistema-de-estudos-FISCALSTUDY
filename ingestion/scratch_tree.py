import os

def print_tree(startpath, exclude_dirs, max_depth=3):
    for root, dirs, files in os.walk(startpath):
        level = root.replace(startpath, '').count(os.sep)
        
        # Limit depth
        if level >= max_depth:
            dirs[:] = []
            continue
            
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        indent = '    ' * level
        
        if root == startpath:
            print(os.path.basename(os.path.abspath(startpath)) + '/')
        else:
            print(indent + os.path.basename(root) + '/')
        
        subindent = '    ' * (level + 1)
        for f in files:
            print(subindent + f)

print_tree('.', ['.git', 'node_modules', 'target', '.venv', 'venv', '__pycache__', '.pytest_cache', '.idx', '.vscode', '.github', '.idea'], max_depth=3)
