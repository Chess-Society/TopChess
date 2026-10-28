import { spawn } from 'node:child_process';
// Solo transporte por stdin; no imprime ni persiste el secreto en disco o argumentos.
if (!process.stdin.isTTY) throw new Error('Se necesita entrada protegida.');
process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdout.write('Esperando secreto por entrada protegida.\n');
let value='';
process.stdin.on('data',chunk=>{
  value+=chunk;
  if(!/[\r\n]/.test(value))return;
  process.stdin.pause();process.stdin.setRawMode(false);
  value=value.trim();
  if(!/^whsec_[A-Za-z0-9]+$/.test(value)){process.stderr.write('Formato de secreto no válido.\n');process.exit(1);}
  const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','put','STRIPE_WEBHOOK_SECRET'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  let log='';child.stdout.on('data',b=>{log+=b;});child.stderr.on('data',b=>{log+=b;});
  child.stdin.end(value+'\n');
  child.on('close',code=>{process.stdout.write(code===0?'Secreto de webhook guardado en Cloudflare.\n':'No se ha podido guardar el secreto de webhook.\n');log='';value='';process.exit(code||0);});
});
