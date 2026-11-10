import asyncio
from web_automation import WebAutomationTool

async def test():
    async with WebAutomationTool(headless=True) as tool:
        await tool.navigate('http://localhost:5173')
        await tool.fill_form({'input[type="email"]': 'admin@sg-sst.local', 'input[type="password"]': 'Admin1234!'})
        await tool.click('button')
        await asyncio.sleep(2)
        
        print('URL:', tool._page.url)
        title = await tool.extract_data('title')
        print('Titulo:', title)
        
        # Buscar elementos del dashboard
        h1 = await tool.extract_data('h1')
        print('H1:', h1)
        
        # Ver enlaces/botones en dashboard
        links = await tool.extract_data('a', multiple=True, method='text')
        print('Enlaces:', links)
        
        buttons = await tool.extract_data('button', multiple=True, method='text')
        print('Botones:', buttons)

asyncio.run(test())