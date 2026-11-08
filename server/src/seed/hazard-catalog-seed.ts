/**
 * Catálogo de peligros precargado para oficio de instalación electrónica
 * (CCTV, alarmas, control de acceso, cableado estructurado)
 * Categorías según GTC 45 y Res. 4272/2021
 */

export interface HazardCatalogSeed {
  codigo: string;
  nombre: string;
  categoria:
    | 'alturas'
    | 'electrico'
    | 'herramientas'
    | 'escaleras'
    | 'ergonomia'
    | 'conduccion'
    | 'cielos_rasos'
    | 'confinados'
    | 'locativo'
    | 'otro';
  descripcion: string;
  riesgo_por_defecto: 'bajo' | 'medio' | 'alto' | 'critico';
  control_sugerido: string;
}

export const hazardCatalogSeed: HazardCatalogSeed[] = [
  // ============================================
  // ALTURAS (Res. 4272/2021)
  // ============================================
  {
    codigo: 'ALT-001',
    nombre: 'Trabajo en escalera tipo tijera > 1.8 m',
    categoria: 'alturas',
    descripcion:
      'Uso de escalera de tijera como puesto de trabajo a más de 1.8 m de altura sin protección contra caídas.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Arnés certificado + línea de vida + anclaje certificado + plan de rescate + capacitación alturas (Res. 4272/2021)',
  },
  {
    codigo: 'ALT-002',
    nombre: 'Trabajo en poste / estructura > 2.5 m',
    categoria: 'alturas',
    descripcion:
      'Instalación de cámaras, antenas o equipos en postes, torres o estructuras metálicas a más de 2.5 m.',
    riesgo_por_defecto: 'critico',
    control_sugerido:
      'Arnés de cuerpo completo + doble línea de vida (restricción y detención) + anclajes certificados + plan de rescate + permiso trabajo en alturas + vigía',
  },
  {
    codigo: 'ALT-003',
    nombre: 'Instalación de cámaras en fachada / techo',
    categoria: 'alturas',
    descripcion:
      'Montaje de cámaras CCTV en fachadas, muros cortina, techos o balcones con riesgo de caída a diferente nivel.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Andamio certificado o plataforma elevadora + arnés + línea de vida horizontal + barandas perimetrales + plan de rescate',
  },
  {
    codigo: 'ALT-004',
    nombre: 'Uso de arnés y línea de vida',
    categoria: 'alturas',
    descripcion:
      'Selección, inspección, ajuste y uso incorrecto de arnés y sistemas de detención/restricción de caídas.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Capacitación obligatoria Res. 4272/2021 + inspección visual antes de cada uso + reemplazo por vida útil o daño + anclajes certificados min. 15 kN',
  },
  {
    codigo: 'ALT-005',
    nombre: 'Trabajo en cubierta / techo inclinado',
    categoria: 'alturas',
    descripcion:
      'Desplazamiento y trabajo sobre tejas, cubiertas metálicas o fibrocemento con riesgo de rotura y caída.',
    riesgo_por_defecto: 'critico',
    control_sugerido:
      'Línea de vida horizontal permanente o temporal + calzado antideslizante + tableros de paso + no pisar claraboyas + plan de rescate',
  },

  // ============================================
  // ELÉCTRICO (RETIE, NFPA 70E)
  // ============================================
  {
    codigo: 'ELE-001',
    nombre: 'Manipulación de cableado energizado',
    categoria: 'electrico',
    descripcion:
      'Conexión, empalme o medición en circuitos bajo tensión sin procedimiento de desenergización (LOTO).',
    riesgo_por_defecto: 'critico',
    control_sugerido:
      'Procedimiento LOTO (Bloqueo-Etiquetado) obligatorio + verificación ausencia de tensión + EPP categoría CAT III/IV + herramienta aislada + permiso trabajo eléctrico',
  },
  {
    codigo: 'ELE-002',
    nombre: 'Conexión en tableros / equipos eléctricos',
    categoria: 'electrico',
    descripcion:
      'Intervención en tableros de distribución, fuentes conmutadas, UPS o equipos de red energizados.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Desenergizar y verificar (LOTO) + EPP arco eléctrico (cara, manos, cuerpo) + barreras aislantes + multímetro CAT III 600V mínimo + procedimiento escrito',
  },
  {
    codigo: 'ELE-003',
    nombre: 'Riesgo de arco eléctrico',
    categoria: 'electrico',
    descripcion:
      'Exposición a arco eléctrico al manipular protecciones, bornes o durante mediciones en tableros.',
    riesgo_por_defecto: 'critico',
    control_sugerido:
      'Análisis de arco eléctrico (IEEE 1584) + EPP categoría según energía incidente (cal/cm²) + pantalla facial + guantes dieléctricos + ropa FR + mantas aislantes',
  },
  {
    codigo: 'ELE-004',
    nombre: 'Uso de multímetro sin categoría adecuada',
    categoria: 'electrico',
    descripcion:
      'Mediciones en instalación eléctrica con multímetro CAT II o sin certificación en circuitos de categoría III/IV.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Multímetro certificado CAT III 600V / CAT IV 300V mínimo + puntas con protección retractil + verificación funcionamiento antes de uso + capacitación NR-10 / RETIE',
  },
  {
    codigo: 'ELE-005',
    nombre: 'Tendido de cableado cerca de líneas de potencia',
    categoria: 'electrico',
    descripcion:
      'Paso de cables UTP, coaxial o fibra en bandejas o ductos cercanos a conductores de media/baja tensión sin separación.',
    riesgo_por_defecto: 'medio',
    control_sugerido:
      'Separación física mínima 30 cm (baja tensión) / 1 m (media tensión) + bandejas metálicas con puesta a tierra + tubería EMT/PVC como barrera + señalización',
  },
  {
    codigo: 'ELE-006',
    nombre: 'Falta de puesta a tierra / equipotencialidad',
    categoria: 'electrico',
    descripcion:
      'Racks, gabinetes, bandejas o carcasas metálicas sin conexión a sistema de puesta a tierra (SPAT).',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Conexión a barra de tierra < 10 Ω + bornes de equipotencialidad en cada rack + verificación periódica con telurómetro + registro de mediciones',
  },

  // ============================================
  // HERRAMIENTAS
  // ============================================
  {
    codigo: 'HER-001',
    nombre: 'Taladro / atornillador inalámbrico en altura',
    categoria: 'herramientas',
    descripcion:
      'Uso de taladro/atornillador en escalera, andamio o plataforma con riesgo de reacción de torque y pérdida de equilibrio.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Taladro con embrague de torque + mango lateral + sujeción de herramienta (cordon) + posición estable + no forzar + EPP ocular',
  },
  {
    codigo: 'HER-002',
    nombre: 'Escalera como puesto de trabajo',
    categoria: 'herramientas',
    descripcion:
      'Realizar trabajos prolongados o que requieren fuerza usando escalera de mano como apoyo principal.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Preferir andamio, plataforma elevadora o escalera de plataforma con baranda + limitar tiempo en escalera < 30 min + tres puntos de apoyo',
  },
  {
    codigo: 'HER-003',
    nombre: 'Cizallas / cortacables / pelacables',
    categoria: 'herramientas',
    descripcion:
      'Corte de cables de acero, coaxial, UTP o fibra con riesgo de cortes, proyección de fragmentos o lesión por fuerza.',
    riesgo_por_defecto: 'medio',
    control_sugerido:
      'Herramienta adecuada al calibre + guantes anti-corte nivel 3-5 + protección ocular + corte controlado alejado del cuerpo + inspección filo',
  },
  {
    codigo: 'HER-004',
    nombre: 'Rotomartillo / taladro percutor en concreto',
    categoria: 'herramientas',
    descripcion:
      'Perforación de muros, losas o vigas para anclajes, bandejas o tuberías con vibración, polvo sílice y ruido.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Aspiración en origen + respirador N95/P100 + protectores auditivos + guantes antivibración + brocas SDS + verificación ausencia de tendidos (detector)',
  },
  {
    codigo: 'HER-005',
    nombre: 'Esmeril / radial para corte de bandejas / perfiles',
    categoria: 'herramientas',
    descripcion:
      'Corte de bandejas porta cables, perfiles metálicos o tubería con riesgo de proyección, chispas, ruido y vibración.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Disco adecuado al material + protector de disco + pantalla facial + guantes + ropa manga larga + área delimitada + extintor cerca + ventilación',
  },

  // ============================================
  // ESCALERAS
  // ============================================
  {
    codigo: 'ESC-001',
    nombre: 'Escalera de mano mal apoyada / inestable',
    categoria: 'escaleras',
    descripcion:
      'Apoyo sobre superficie irregular, resbaladiza, sin antideslizantes o sin ángulo correcto (75° / regla 1:4).',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Inspección antes de uso + patas antideslizantes + apoyo firme y nivelado + ángulo 75° (1 m base por 4 m altura) + amarre superior o vigía',
  },
  {
    codigo: 'ESC-002',
    nombre: 'Escalera sin antideslizante / peldaños dañados',
    categoria: 'escaleras',
    descripcion:
      'Escaleras con peldaños doblados, agrietados, sucios de grasa/pintura o tacos de goma desgastados/ausentes.',
    riesgo_por_defecto: 'medio',
    control_sugerido:
      'Inspección visual mensual (registro) + retiro inmediato si daño + limpieza peldaños + reemplazo tacos + no pintar escaleras (oculta grietas)',
  },
  {
    codigo: 'ESC-003',
    nombre: 'Sobrepasar peldaño superior / pararse en dos últimos',
    categoria: 'escaleras',
    descripcion:
      'Trabajar parado en los dos últimos peldaños o en la plataforma superior de escalera tijera sin baranda.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Regla: no subir últimos 2 peldaños (mano) / no pararse en plataforma (tijera) + usar escalera más alta o andamio + capacitación uso seguro',
  },
  {
    codigo: 'ESC-004',
    nombre: 'Escalera metálica cerca de líneas eléctricas',
    categoria: 'escaleras',
    descripcion:
      'Uso de escalera de aluminio o fibra de vidrio conductora a menos de 1 m de tendidos energizados.',
    riesgo_por_defecto: 'critico',
    control_sugerido:
      'Escalera dieléctrica (fibra de vidrio certificada) + distancia mínima 1 m (BT) / 3 m (MT) + señalización + LOTO si posible',
  },

  // ============================================
  // ERGONOMÍA
  // ============================================
  {
    codigo: 'ERG-001',
    nombre: 'Carga manual de equipos pesados (DVR, rack, baterías)',
    categoria: 'ergonomia',
    descripcion:
      'Levantamiento y transporte de grabadores DVR/NVR (>15 kg), racks, baterías UPS o bobinas de cable sin ayuda mecánica.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Carretilla / diablo / montacargas + trabajo en equipo (2 personas) + técnica de levantamiento (flexionar rodillas, carga cerca cuerpo) + pausas activas',
  },
  {
    codigo: 'ERG-002',
    nombre: 'Postura forzada en cableado en falso techo',
    categoria: 'ergonomia',
    descripcion:
      'Trabajo prolongado en posición encorvada, arrodillado o con brazos elevados dentro de plenum / falso techo.',
    riesgo_por_defecto: 'medio',
    control_sugerido:
      'Taburete / asiento ergonómico + iluminación portátil + rotación de tareas cada 45 min + estiramientos + bandeja de herramientas al alcance',
  },
  {
    codigo: 'ERG-003',
    nombre: 'Movimientos repetitivos en tendido de cable',
    categoria: 'ergonomia',
    descripcion:
      'Tendido, jalado y amarre de cables UTP/coaxial/fibra por largas distancias con movimientos cíclicos de muñeca/hombro.',
    riesgo_por_defecto: 'medio',
    control_sugerido:
      'Desenrollador de bobinas + lubricante jalado + guantes ergonómicos + rotación tareas + pausas 5 min cada hora + herramienta de amarre (no dientes)',
  },

  // ============================================
  // CONDUCCIÓN
  // ============================================
  {
    codigo: 'CON-001',
    nombre: 'Traslado entre sedes / obras en vehículo de la empresa',
    categoria: 'conduccion',
    descripcion:
      'Conducción en vías urbanas e interurbanas con riesgo de colisión, atropello o volcamiento.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Licencia vigente categoría adecuada + curso conducción defensiva + revisión vehículo (frenos, luces, neumáticos) + plan de ruta + no usar celular + cinturón',
  },
  {
    codigo: 'CON-002',
    nombre: 'Carga mal asegurada en vehículo (escaleras, bobinas, herramientas)',
    categoria: 'conduccion',
    descripcion:
      'Transporte de escaleras, bobinas de cable, herramientas o equipos sueltos en cabina o caja sin sujeción.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Redes / cinchas / barras de sujeción certificadas + separador cabina-carga + distribución peso equilibrada + revisión antes de salir + límite peso vehículo',
  },

  // ============================================
  // CIELOS RASOS / FALSO TECHO
  // ============================================
  {
    codigo: 'CIE-001',
    nombre: 'Trabajo en falso techo (caída entre vigas / rotura placa)',
    categoria: 'cielos_rasos',
    descripcion:
      'Desplazamiento sobre estructura de cielorraso (perfiles, alambres) con riesgo de caer al pisar zona sin apoyo o romper placa yeso/mineral.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Tableros de paso (mín. 30 cm ancho) + solo pisar sobre vigas/perfiles + iluminación adecuada + arnés si > 2 m altura libre + vigía en acceso',
  },
  {
    codigo: 'CIE-002',
    nombre: 'Acceso por trampa / registran sin baranda',
    categoria: 'cielos_rasos',
    descripcion:
      'Ingreso a plenum por trampa de techo sin baranda perimetral, escalera fija o protección de borde.',
    riesgo_por_defecto: 'medio',
    control_sugerido:
      'Baranda desmontable en trampa + escalera de mano asegurada + iluminación + comunicación con exterior + plan de rescate si espacio confinado',
  },

  // ============================================
  // ESPACIOS CONFINADOS
  // ============================================
  {
    codigo: 'CFN-001',
    nombre: 'Paso de cables por ductos / cañerías',
    categoria: 'confinados',
    descripcion:
      'Ingreso parcial o total a ductos, cañerías o bandejas cerradas para jalado de cables con riesgo de atmósfera peligrosa, atrapamiento.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Evaluación atmósfera (O2, CO, H2S, LEL) antes y durante + permiso ingreso espacio confinado + vigía exterior + comunicación + equipo rescate + ventilación forzada',
  },
  {
    codigo: 'CFN-002',
    nombre: 'Inspección / trabajo en cuartos de telecom cerrados',
    categoria: 'confinados',
    descripcion:
      'Ingreso a cuartos de servidores, MDF/IDF, cuartos de baterías con ventilación limitada, riesgo de atmósfera deficiente o fuga gas refrigerante.',
    riesgo_por_defecto: 'medio',
    control_sugerido:
      'Ventilación previa 15 min + detector gases portátil + permiso si volumen < 2 m³/persona + vigía + salida despejada + señalización "Espacio Confinado"',
  },

  // ============================================
  // LOCATIVO
  // ============================================
  {
    codigo: 'LOC-001',
    nombre: 'Piso mojado / aceitoso / irregular en bodega / obra',
    categoria: 'locativo',
    descripcion:
      'Superficies resbaladizas por derrames, humedad, polvo o desniveles en áreas de almacenamiento, talleres o frentes de obra.',
    riesgo_por_defecto: 'medio',
    control_sugerido:
      'Limpieza inmediata derrames + señalización "Piso Mojado" + calzado antideslizante (SRC) + buena iluminación + pasillos libres + reparación desniveles',
  },
  {
    codigo: 'LOC-002',
    nombre: 'Iluminación deficiente en bodega / área de trabajo',
    categoria: 'locativo',
    descripcion:
      'Niveles de iluminancia por debajo de 200 lux (tareas generales) o 500 lux (tareas finas) en bodegas, cuartos técnicos o frentes de obra.',
    riesgo_por_defecto: 'bajo',
    control_sugerido:
      'Medición luxómetro + luminarias LED adecuadas + iluminación de emergencia + mantenimiento preventivo luminarias + luz portátil para tareas puntuales',
  },
  {
    codigo: 'LOC-003',
    nombre: 'Salidas de emergencia bloqueadas / sin señalizar',
    categoria: 'locativo',
    descripcion:
      'Rutas de evacuación obstruidas por materiales, equipos, archivadores o puertas cerradas con llave; señalización fotoluminiscente ausente.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Inspección diaria rutas evacuación + puertas con barra antipánico (sin llave) + señalización fotoluminiscente + simulacros semestrales + plano evacuación visible',
  },

  // ============================================
  // OTRO
  // ============================================
  {
    codigo: 'OTR-001',
    nombre: 'Exposición a ruido alto (taladro, rotomartillo, esmeril)',
    categoria: 'otro',
    descripcion:
      'Niveles de presión sonora > 85 dB(A) durante uso de herramientas eléctricas/neumáticas sin protección auditiva adecuada.',
    riesgo_por_defecto: 'medio',
    control_sugerido:
      'Protección auditiva (tapones/orejeras SNR > 25 dB) + rotación tareas + mantenimiento herramientas (reduce ruido) + audiometría anual + señalización zona ruidosa',
  },
  {
    codigo: 'OTR-002',
    nombre: 'Manipulación de fibra óptica (riesgo ocular / cortes)',
    categoria: 'otro',
    descripcion:
      'Corte, pelado, empalme o inspección de fibra óptica con riesgo de irritación ocular por láser (clase 1M/3R) y micro-cortes por fragmentos de vidrio.',
    riesgo_por_defecto: 'medio',
    control_sugerido:
      'Nunca mirar extremo de fibra activa + microscopio con filtro IR + contenedor sharps para fragmentos + guantes + limpieza con alcohol isopropílico 99% + capacitación específica',
  },
  {
    codigo: 'OTR-003',
    nombre: 'Trabajo en condiciones climáticas adversas (lluvia, viento, sol extremo)',
    categoria: 'otro',
    descripcion:
      'Instalaciones en exterior (fachadas, postes, techos) expuestas a lluvia, viento > 40 km/h, radiación UV índice > 8 o temperatura > 35°C.',
    riesgo_por_defecto: 'alto',
    control_sugerido:
      'Suspender trabajo en altura si viento > 40 km/h o lluvia + protección solar (gorra, manga larga, FPS 50) + hidratación + ropa impermeable + plan de contingencia climática',
  },
];
