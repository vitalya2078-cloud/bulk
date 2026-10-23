# Слабый сервер: часть ответов рвёт, часть отдаёт ошибкой, при нагрузке - чаще
import http.server, socketserver, random, os, sys, threading
os.chdir(sys.argv[1]); PORT=int(sys.argv[2]); RATE=float(sys.argv[3]) if len(sys.argv)>3 else .3
busy=[0]; lock=threading.Lock()
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_GET(self):
        p=self.path.split('?')[0]
        if not p.startswith('/assets/'): return super().do_GET()
        with lock: busy[0]+=1; n=busy[0]
        try:
            f=self.translate_path(self.path)
            if not os.path.isfile(f): return self.send_error(404)
            data=open(f,'rb').read()
            r=random.random(); rate=RATE*(1.6 if n>3 else 1)
            if r<rate*0.3: return self.send_error(500)
            self.send_response(200); self.send_header('Content-Type','image/webp' if f.endswith('webp') else 'audio/mpeg')
            if r<rate*0.65:  # оборвать с верным Content-Length
                self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data[:len(data)//3]); self.close_connection=True; return
            if r<rate:       # оборвать без Content-Length
                self.end_headers(); self.wfile.write(data[:len(data)//2]); self.close_connection=True; return
            self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
        finally:
            with lock: busy[0]-=1
class S(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads=True
S(('',PORT),H).serve_forever()
