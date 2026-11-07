#!/usr/bin/env python3
"""
Ejemplo de uso de la herramienta de automatización web.
Muestra cómo abrir Chromium, extraer datos e interactuar con botones.
"""

import asyncio
import json
from web_automation import WebAutomationTool, scrape_website


async def ejemplo_extraccion():
    """Extrae datos de una página web."""
    async with WebAutomationTool(headless=True) as tool:
        await tool.navigate("https://example.com")
        
        # Extraer el título
        title = await tool.extract_data("title")
        print(f"Título de la página: {title}")
        
        # Extraer el encabezado h1
        h1 = await tool.extract_data("h1")
        print(f"Encabezado principal: {h1}")
        
        # Extraer párrafos
        paragraphs = await tool.extract_data("p", multiple=True)
        print(f"Párrafos encontrados: {len(paragraphs)}")
        for p in paragraphs:
            print(f" - {p}")


async def ejemplo_click():
    """Demuestra interacción con botones."""
    async with WebAutomationTool(headless=True) as tool:
        await tool.navigate("https://example.com")
        
        # Hacer clic en un enlace (ejemplo)
        success = await tool.click("a")
        print(f"Clic realizado: {success}")
        
        # Si hay un formulario, rellenarlo
        # await tool.fill_form({"input[name='name']": "Juan Pérez"})
        # await tool.click("button[type='submit']")


async def ejemplo_scrape_convenience():
    """Usa la función de conveniencia scrape_website."""
    result = await scrape_website(
        url="https://example.com",
        extractors=[
            {"selector": "title", "name": "titulo", "method": "text"},
            {"selector": "h1", "name": "encabezado", "method": "text"},
            {"selector": "p", "name": "parrafos", "method": "text", "multiple": True},
        ],
        headless=True
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))


async def main():
    print("=== Ejemplo 1: Extracción de datos ===")
    await ejemplo_extraccion()
    
    print("\n=== Ejemplo 2: Scrape con función de conveniencia ===")
    await ejemplo_scrape_convenience()
    
    print("\n=== Ejemplo 3: Interacción con botones ===")
    await ejemplo_click()
    
    print("\nTodos los ejemplos completados.")


if __name__ == "__main__":
    asyncio.run(main())