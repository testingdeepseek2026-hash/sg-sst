import asyncio
from web_automation import WebAutomationTool

async def test():
    async with WebAutomationTool(headless=True) as tool:
        await tool.navigate('http://localhost:5173')
        
        # Extraer detalles de inputs del formulario
        inputs = await tool.extract_data('input', multiple=True, method='attribute', attribute='placeholder')
        print(f'Placeholders de inputs: {inputs}')
        
        inputs_type = await tool.extract_data('input', multiple=True, method='attribute', attribute='type')
        print(f'Tipos de input: {inputs_type}')
        
        # Extraer texto del boton
        btn_text = await tool.extract_data('button', method='text')
        print(f'Texto del boton: {btn_text}')
        
        # Extraer el enlace
        link = await tool.extract_data('a', multiple=True, method='attribute', attribute='href')
        print(f'Href del enlace: {link}')
        
        link_text = await tool.extract_data('a', multiple=True, method='text')
        print(f'Texto del enlace: {link_text}')
        
        # Probar hacer clic en el boton Ingresar
        success = await tool.click('button')
        print(f'Clic en boton: {success}')
        
        # Ver si hay mensaje de error despues del clic
        error = await tool.extract_data('.error, .alert, [class*="error"], [class*="alert"]')
        print(f'Mensaje de error/alerta: {error}')

asyncio.run(test())