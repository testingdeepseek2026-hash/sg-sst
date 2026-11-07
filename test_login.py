import asyncio
from web_automation import WebAutomationTool

async def test_login():
    async with WebAutomationTool(headless=True) as tool:
        await tool.navigate('http://localhost:5173')
        
        # Rellenar formulario con credenciales demo admin
        await tool.fill_form({
            'input[type="email"]': 'admin@sg-sst.local',
            'input[type="password"]': 'Admin1234!'
        })
        
        print("Formulario rellenado")
        
        # Hacer clic en Ingresar
        success = await tool.click('button')
        print(f"Clic en Ingresar: {success}")
        
        # Esperar a que navegue (si hay redirección)
        await asyncio.sleep(2)
        
        # Verificar nueva página
        new_url = tool._page.url if tool._page else "unknown"
        print(f"Nueva URL: {new_url}")
        
        # Verificar título
        title = await tool.extract_data('title')
        print(f"Nuevo título: {title}")
        
        # Buscar elementos del dashboard
        body = await tool.extract_data('body')
        print(f"Contenido (primeros 500 chars): {body[:500] if body else None}")

asyncio.run(test_login())