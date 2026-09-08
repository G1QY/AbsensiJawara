"""Reject obvious private credentials and accidentally packaged config. Never print secret values."""
from pathlib import Path
import re,sys
root=Path(__file__).resolve().parents[1]
patterns=[re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),re.compile(r'\bAKIA[0-9A-Z]{16}\b'),re.compile(r'\bsb_secret_[A-Za-z0-9_-]{20,}\b')]
issues=[]
for p in root.rglob('*'):
 rel=p.relative_to(root)
 if any(x in {'node_modules','.git','.figma','dist'} for x in rel.parts) or not p.is_file():continue
 if p.name=='.env' or (p.name.startswith('.env.') and not p.name.endswith(('example','sample'))):issues.append(str(rel));continue
 if p.stat().st_size>2000000:continue
 try:text=p.read_text()
 except UnicodeError:continue
 if any(pattern.search(text) for pattern in patterns):issues.append(str(rel))
if issues:print('Potential secret files:',*sorted(set(issues)),sep='\n');sys.exit(1)
print('Secret/config scan passed. Also scan Git history before publication.')
