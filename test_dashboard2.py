import asyncio
import sys
from web_automation import WebAutomationTool

# Forzar UTF-8 en Windows
sys.stdout.reconfigure(encoding='utf-8')

async def test():
    async with WebAutomationTool(headless=True) as tool:
        await tool.navigate('http://localhost:5173')
        await tool.fill_form({'input[type="email"]': 'admin@sg-sst.local', 'input[type="password"]': 'Admin1234!'})
        await tool.click('button')
        await asyncio.sleep(2)
        
        print('URL:', tool._page.url)
        title = await tool.extract_data('title')
        print('Titulo:', title)
        
        h1 = await tool.extract_data('h1')
        print('H1:', h1)
        
        links = await tool.extract_data('a', multiple=True, method='text')
        print('Enlaces:', [l.encode('ascii', 'replace').decode() if l else 'None' for l in links])
        
        buttons = await tool.extract_data('button', multiple=True, method='text')
        print('Botones:', [b.encode('ascii', 'replace').decode() if b else 'None' for b in buttons])
        
        # Extraer todo el body como texto
        body = await tool.extract_data('body')
        if body:
            clean_body = body.encode('ascii', 'replace').decode()
            print('Body (primeros 1000 chars):', clean_body[:1000])

asyncio.run(test())