"""Create a restricted local DB dump; schedule and off-site encryption are deployment tasks."""
import os,subprocess,datetime
from pathlib import Path
required=['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE']
if any(not os.environ.get(k) for k in required):raise SystemExit('Set PostgreSQL connection environment variables first.')
os.umask(0o077)
folder=Path(os.environ.get('BACKUP_DIRECTORY','backups'));folder.mkdir(parents=True,exist_ok=True)
target=folder/('fotosnaps-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.dump')
env=dict(os.environ,PGSSLMODE='require')
try:
 subprocess.run(['pg_dump','--format=custom','--no-owner','--no-acl','--file',str(target)],env=env,check=True)
 subprocess.run(['pg_restore','--list',str(target)],stdout=subprocess.DEVNULL,check=True)
except subprocess.CalledProcessError:
 target.unlink(missing_ok=True);raise SystemExit('Backup failed. No valid backup was produced.')
print('Database dump created:',target)
