#!/usr/bin/env python3
"""
Herramienta de automatización web con Chromium via Playwright.
Permite abrir Chromium, extraer datos de páginas web e interactuar con botones.
"""

import asyncio
import re
import json
from typing import Dict, List, Any, Optional, Union
from pathlib import Path

try:
    from playwright.async_api import async_playwright, Page, Browser, BrowserContext
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    raise ImportError(
        "Playwright no está instalado. Ejecuta: pip install playwright && playwright install chromium"
    )


class WebAutomationTool:
    """
    Herramienta para automatizar navegación web con Chromium.
    
    Uso:
        tool = WebAutomationTool()
        
        # Navegar a una página
        await tool.navigate("https://example.com")
        
        # Extraer datos
        data = await tool.extract_data(selector="div.content", method="text")
        
        # Hacer clic en un botón
        await tool.click("#submit-button")
        
        # Enviar formulario
        await tool.fill_form({"name": "John", "email": "john@example.com"})
        
        # Cerrar
        await tool.close()
    """
    
    def __init__(self, headless: bool = True, browser_path: Optional[str] = None):
        """
        Inicializa la herramienta de automatización.
        
        Args:
            headless: Si True, Chromium se ejecuta sin ventana visible
            browser_path: Ruta opcional al ejecutable de Chromium
        """
        self.headless = headless
        self.browser_path = browser_path
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None
        
    async def start(self) -> bool:
        """
        Inicia la instancia de Playwright y Chromium.
        
        Returns:
            True si se inició correctamente
        """
        self._playwright = await async_playwright().start()
        
        browser_kwargs = {"headless": self.headless}
        if self.browser_path:
            browser_kwargs["executable_path"] = self.browser_path
            
        self._browser = await self._playwright.chromium.launch(**browser_kwargs)
        self._context = await self._browser.new_context()
        self._page = await self._context.new_page()
        
        return True
    
    async def navigate(self, url: str, wait_until: str = "networkidle") -> None:
        """
        Navega a una URL.
        
        Args:
            url: URL a navegar
            wait_until: Cuándo esperar ('load', 'domcontentloaded', 'networkidle', 'commit')
        """
        if not self._page:
            await self.start()
        await self._page.goto(url, wait_until=wait_until)
    
    async def extract_data(
        self, 
        selector: str, 
        method: str = "text",
        attribute: Optional[str] = None,
        multiple: bool = False
    ) -> Union[str, List[str], None]:
        """
        Extrae datos de una página web.
        
        Args:
            selector: Selector CSS del elemento
            method: Método de extracción ('text', 'html', 'attribute', 'src', 'href')
            attribute: Atributo específico cuando method='attribute'
            multiple: Si True, devuelve lista de todos los elementos
            
        Returns:
            Texto/HTML/atributo del elemento o lista de elementos
        """
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        if multiple:
            elements = await self._page.query_selector_all(selector)
            results = []
            for el in elements:
                result = await self._get_element_data(el, method, attribute)
                results.append(result)
            return results
        else:
            element = await self._page.query_selector(selector)
            if element:
                return await self._get_element_data(element, method, attribute)
            return None
    
    async def _get_element_data(
        self, 
        element, 
        method: str, 
        attribute: Optional[str] = None
    ) -> Any:
        """Helper para obtener datos de un elemento."""
        if method == "text":
            return await element.text_content()
        elif method == "html":
            return await element.inner_html()
        elif method == "attribute":
            return await element.get_attribute(attribute or "src")
        else:
            return await element.get_attribute(method)
    
    async def extract_json_data(self, selector: str = "script[type='application/ld+json']") -> List[Dict]:
        """
        Extrae datos JSON-LD de la página.
        
        Args:
            selector: Selector para los scripts JSON-LD
            
        Returns:
            Lista de objetos JSON extraídos
        """
        scripts = await self.extract_data(selector, method="text", multiple=True)
        results = []
        for script in scripts or []:
            try:
                data = json.loads(script)
                results.append(data)
            except json.JSONDecodeError:
                continue
        return results
    
    async def click(self, selector: str, timeout: int = 30000) -> bool:
        """
        Hace clic en un elemento.
        
        Args:
            selector: Selector CSS del elemento
            timeout: Timeout en milisegundos
            
        Returns:
            True si el clic fue exitoso
        """
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        try:
            await self._page.click(selector, timeout=timeout)
            return True
        except Exception as e:
            print(f"Error al hacer clic: {e}")
            return False
    
    async def hover(self, selector: str) -> bool:
        """
        Hace hover sobre un elemento.
        
        Args:
            selector: Selector CSS del elemento
            
        Returns:
            True si el hover fue exitoso
        """
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        try:
            await self._page.hover(selector)
            return True
        except Exception as e:
            print(f"Error al hacer hover: {e}")
            return False
    
    async def fill_form(self, data: Dict[str, str], clear: bool = True) -> bool:
        """
        Rellena un formulario con los datos proporcionados.
        
        Args:
            data: Diccionario con name=selector y value=valor
            clear: Si True, limpia el campo antes de escribir
            
        Returns:
            True si se completó exitosamente
        """
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        for name, value in data.items():
            try:
                if clear:
                    await self._page.fill(name, "")
                await self._page.fill(name, value)
            except Exception as e:
                print(f"Error al rellenar {name}: {e}")
                return False
        return True
    
    async def type_text(self, selector: str, text: str, delay: int = 0) -> bool:
        """
        Escribe texto en un campo con opción de retraso entre caracteres.
        
        Args:
            selector: Selector del campo de entrada
            text: Texto a escribir
            delay: Retraso en milisegundos entre caracteres
            
        Returns:
            True si se escribió correctamente
        """
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        try:
            await self._page.type(selector, text, delay=delay)
            return True
        except Exception as e:
            print(f"Error al escribir texto: {e}")
            return False
    
    async def select_option(self, selector: str, values: Union[str, List[str]]) -> bool:
        """
        Selecciona opciones en un menú desplegable.
        
        Args:
            selector: Selector del select
            values: Valor(es) a seleccionar
            
        Returns:
            True si se seleccionó correctamente
        """
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        try:
            if isinstance(values, str):
                values = [values]
            await self._page.select_option(selector, values)
            return True
        except Exception as e:
            print(f"Error al seleccionar opción: {e}")
            return False
    
    async def submit_form(self, selector: str = "form") -> bool:
        """
        Envía un formulario.
        
        Args:
            selector: Selector del formulario o botón submit
            
        Returns:
            True si se envió correctamente
        """
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        try:
            form = await self._page.query_selector(selector)
            if form:
                await form.evaluate("form => form.submit()")
                return True
            return False
        except Exception as e:
            print(f"Error al enviar formulario: {e}")
            return False
    
    async def wait_for_selector(self, selector: str, state: str = "visible", timeout: int = 30000) -> bool:
        """
        Espera a que un selector esté disponible.
        
        Args:
            selector: Selector CSS
            state: Estado esperado ('attached', 'detached', 'visible', 'hidden')
            timeout: Timeout en milisegundos
            
        Returns:
            True si el elemento apareció
        """
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        try:
            await self._page.wait_for_selector(selector, state=state, timeout=timeout)
            return True
        except Exception:
            return False
    
    async def take_screenshot(self, path: Optional[str] = None) -> bytes:
        """
        Toma una captura de pantalla de la página actual.
        
        Args:
            path: Ruta para guardar la imagen (si None, retorna bytes)
            
        Returns:
            Bytes de la imagen o None si se guardó en disco
        """
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        screenshot = await self._page.screenshot(path=path)
        return screenshot
    
    async def evaluate_js(self, script: str) -> Any:
        """
        Ejecuta código JavaScript en el contexto de la página.
        
        Args:
            script: Código JavaScript a ejecutar
            
        Returns:
            Resultado de la evaluación
        """
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        return await self._page.evaluate(script)
    
    async def scroll_to_bottom(self) -> None:
        """Scrollea hasta el final de la página."""
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        await self._page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    
    async def scroll_to_element(self, selector: str) -> bool:
        """
        Hace scroll hasta un elemento específico.
        
        Args:
            selector: Selector CSS del elemento
            
        Returns:
            True si el scroll fue exitoso
        """
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        try:
            await self._page.scroll_to_element(selector)
            return True
        except Exception as e:
            print(f"Error al hacer scroll: {e}")
            return False
    
    async def get_cookies(self) -> List[Dict]:
        """
        Obtiene todas las cookies de la página.
        
        Returns:
            Lista de cookies
        """
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        return await self._context.cookies()
    
    async def set_cookie(self, name: str, value: str, domain: Optional[str] = None) -> None:
        """
        Establece una cookie.
        
        Args:
            name: Nombre de la cookie
            value: Valor de la cookie
            domain: Dominio opcional
        """
        if not self._page:
            raise RuntimeError("WebBrowser no inicializado. Llama a start() primero.")
            
        cookie = {"name": name, "value": value}
        if domain:
            cookie["domain"] = domain
        await self._context.add_cookies([cookie])
    
    async def close(self) -> None:
        """Cierra el navegador y libera recursos."""
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
    
    async def __aenter__(self):
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


# Función de conveniencia para uso rápido
async def scrape_website(
    url: str,
    extractors: List[Dict[str, str]],
    headless: bool = True
) -> Dict[str, Any]:
    """
    Función de conveniencia para extraer múltiples datos de una página.
    
    Args:
        url: URL a navegar
        extractors: Lista de dicts con keys: selector, name, method (default: text)
        headless: Si True, Chromium se ejecuta sin ventana
        
    Returns:
        Diccionario con los datos extraídos
    """
    result = {}
    tool = WebAutomationTool(headless=headless)
    
    try:
        await tool.start()
        await tool.navigate(url)
        
        for extractor in extractors:
            name = extractor.get("name", extractor.get("selector"))
            method = extractor.get("method", "text")
            attribute = extractor.get("attribute")
            multiple = extractor.get("multiple", False)
            
            result[name] = await tool.extract_data(
                selector=extractor["selector"],
                method=method,
                attribute=attribute,
                multiple=multiple
            )
    finally:
        await tool.close()
    
    return result


# CLI para uso desde línea de comandos
if __name__ == "__main__":
    import argparse
    import sys
    
    parser = argparse.ArgumentParser(description="Herramienta de automatización web")
    parser.add_argument("url", help="URL a visitar")
    parser.add_argument("--extract", nargs="*", help="Selectores CSS a extraer")
    parser.add_argument("--output", "-o", help="Archivo de salida (JSON)")
    parser.add_argument("--headless", action="store_true", default=True, help="Ejecutar sin ventana")
    
    args = parser.parse_args()
    
    async def main():
        tool = WebAutomationTool(headless=args.headless)
        try:
            await tool.start()
            await tool.navigate(args.url)
            
            if args.extract:
                result = {}
                for selector in args.extract:
                    result[selector] = await tool.extract_data(selector)
                print(json.dumps(result, indent=2, ensure_ascii=False))
            else:
                # Muestra información básica de la página
                title = await tool.extract_data("title")
                url = tool._page.url if tool._page else args.url
                print(f"Título: {title}")
                print(f"URL: {url}")
                
        finally:
            await tool.close()
    
    asyncio.run(main())