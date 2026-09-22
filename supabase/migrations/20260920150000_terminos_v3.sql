-- Términos y Condiciones — versión 3.
--
-- Qué cambia respecto de la v2:
--
-- * Sección 6 nueva, "Historial sanitario de los caballos": deja explícito que
--   el registro es del animal y no de personas. Es la misma aclaración que hacen
--   la página `/legales/terminos` y la sección 2.5 de la política de privacidad,
--   donde sostiene que no se tratan datos sensibles del art. 7 de la Ley 25.326.
--   Que los dos textos digan lo mismo es el punto: si algún día se discute, no
--   puede haber dos versiones del mismo hecho.
-- * Las secciones 6 a 16 de la v2 pasan a 7 a 17.
-- * Sección 7 (antes 6): remite a la Política de Privacidad para el tratamiento
--   de datos personales, que antes no se mencionaba.
-- * Sección 17 (antes 16): la casilla de contacto reemplaza al placeholder
--   "[tu email]" que quedó en la v2.
--
-- Efecto al aplicarla: `activo` pasa a la v3 y TODOS los usuarios ven el modal
-- de aceptación en su próximo inicio de sesión. Las aceptaciones de la v2 quedan
-- en `terminos_aceptacion` con su propio `version_id`, así que el historial de
-- quién aceptó qué versión no se pierde.

-- Una sola versión activa por vez (hay un índice único parcial sobre `activo`),
-- así que primero se baja la anterior.
UPDATE terminos_condiciones SET activo = false WHERE activo = true;

INSERT INTO terminos_condiciones (version, titulo, contenido, activo)
VALUES (
  3,
  'Términos y Condiciones',
  $terminos$

HarasManager – Versión 3 – Septiembre 2026

1. Aceptación

Al registrarse, acceder o utilizar HarasManager (“la Plataforma”), el usuario acepta íntegramente los presentes Términos y Condiciones.

Si el usuario no acepta cualquiera de estas disposiciones, deberá abstenerse de utilizar la Plataforma.

El uso continuado implica aceptación permanente de futuras modificaciones.

⸻

2. Descripción del servicio

HarasManager es un software de gestión destinado a establecimientos equinos, veterinarios, criadores, haras, propietarios, administradores y organizaciones vinculadas al ámbito ecuestre.

Las funcionalidades pueden incluir, sin limitarse a:

* gestión de caballos;
* historial veterinario;
* tratamientos;
* transferencias;
* documentos;
* usuarios y permisos;
* registros administrativos;
* reportes;
* seguimiento sanitario;
* almacenamiento de datos operativos.

HarasManager podrá modificar, ampliar, eliminar, restringir o discontinuar funcionalidades sin previo aviso.

⸻

3. Cuenta y seguridad

Cada usuario es responsable de:

* mantener la confidencialidad de sus credenciales;
* restringir el acceso a su cuenta;
* toda actividad realizada bajo sus accesos;
* la administración de permisos internos de su organización.

HarasManager no será responsable por:

* robo de credenciales;
* accesos indebidos;
* negligencia del usuario;
* contraseñas débiles;
* compartición de usuarios.

El usuario deberá informar inmediatamente cualquier sospecha de acceso no autorizado.

⸻

4. Uso permitido

El usuario se compromete a:

* utilizar la Plataforma únicamente para fines legales;
* respetar la normativa aplicable;
* no interferir con el funcionamiento del sistema;
* no intentar vulnerar seguridad, bases de datos, APIs o infraestructura.

Queda expresamente prohibido:

* ingeniería inversa;
* scraping automatizado;
* extracción masiva de datos;
* reproducción no autorizada;
* venta, sublicencia o redistribución del software;
* pruebas de penetración sin autorización escrita.

⸻

5. Responsabilidad sobre la información cargada

El usuario declara ser único responsable por:

* veracidad;
* legalidad;
* exactitud;
* actualización;
* autorización de uso de los datos cargados.

Esto incluye datos relativos a:

* caballos;
* propietarios;
* veterinarios;
* empleados;
* establecimientos;
* documentación;
* historiales médicos;
* tratamientos;
* certificados;
* registros administrativos.

HarasManager no valida ni garantiza la autenticidad de la información ingresada.

Toda decisión veterinaria, comercial, administrativa o legal basada en información almacenada es exclusiva responsabilidad del usuario.

⸻

6. Historial sanitario de los caballos

El registro es de los caballos: lo que se documenta en la Plataforma es la historia sanitaria de cada animal, que lo acompaña a lo largo de su vida y de sus cambios de establecimiento, y no información clínica de personas.

Los registros cargados por un veterinario son inmutables una vez guardados: solo pueden ser editados por el profesional que los creó. Esto garantiza la trazabilidad del historial sanitario de cada animal.

Cuando un caballo se transfiere a otro establecimiento, su ficha y sus registros sanitarios lo acompañan, porque la trazabilidad es el objeto mismo del registro. El establecimiento de destino accede a los eventos anteriores y a la identificación de los profesionales que los firmaron.

Los datos personales asociados a esos registros —el nombre y la matrícula del veterinario actuante— se tratan según la Política de Privacidad.

⸻

7. Datos personales y confidencialidad

HarasManager realizará esfuerzos razonables para proteger la información almacenada mediante medidas técnicas y organizativas.

Sin embargo, el usuario reconoce que:

ningún sistema digital es completamente inmune a fallos, accesos no autorizados, ataques informáticos, pérdida de datos o interrupciones.

HarasManager no garantiza seguridad absoluta.

Podremos utilizar proveedores externos de infraestructura, hosting, backups, autenticación, analítica y almacenamiento.

El usuario autoriza dicho tratamiento técnico cuando sea necesario para operar el servicio.

La información podrá divulgarse únicamente cuando:

* exista obligación legal;
* orden judicial;
* requerimiento administrativo válido;
* prevención de fraude o incidentes de seguridad.

El tratamiento de los datos personales de los usuarios se rige por la Política de Privacidad de HarasManager, disponible en la Plataforma, que forma parte integrante de estos Términos.

⸻

8. Protección de datos y cumplimiento legal

Cada usuario u organización es responsable del cumplimiento de las leyes aplicables respecto del tratamiento de datos personales, veterinarios, sanitarios o comerciales.

El uso de la Plataforma no reemplaza obligaciones regulatorias, veterinarias, sanitarias, registrales ni administrativas.

HarasManager actúa como proveedor tecnológico y no como asesor legal, médico veterinario, autoridad sanitaria ni certificador oficial.

⸻

9. Disponibilidad del servicio

HarasManager procura mantener disponibilidad continua, pero no garantiza uptime ininterrumpido.

Podrán producirse:

* mantenimiento;
* actualizaciones;
* fallos técnicos;
* interrupciones;
* incompatibilidades;
* problemas de terceros.

HarasManager no será responsable por:

* indisponibilidad temporal;
* pérdida de acceso;
* demoras;
* errores de sincronización;
* fallos de internet;
* errores de proveedores externos.

⸻

10. Copias de seguridad y pérdida de datos

Aunque podrán existir mecanismos de backup, el usuario acepta que:

la conservación de copias adicionales de información crítica continúa siendo responsabilidad propia.

HarasManager no garantiza recuperación total ante:

* corrupción;
* eliminación accidental;
* ataques;
* desastres tecnológicos;
* errores humanos.

La responsabilidad máxima del proveedor quedará limitada según lo establecido en la cláusula de limitación de responsabilidad.

⸻

11. Limitación de responsabilidad

En la máxima medida permitida por la ley aplicable, HarasManager, sus desarrolladores, propietarios, empleados, contratistas o afiliados no serán responsables por daños directos, indirectos, incidentales, especiales, consecuenciales o punitivos derivados de:

* pérdida de información;
* pérdida económica;
* pérdida comercial;
* decisiones veterinarias;
* errores operativos;
* interrupción del negocio;
* accesos no autorizados;
* errores de terceros;
* uso indebido del sistema.

La responsabilidad total acumulada de HarasManager, cualquiera sea la causa reclamada, no podrá exceder el monto efectivamente abonado por el usuario durante los últimos 12 meses.

⸻

12. Indemnidad

El usuario acepta defender, indemnizar y mantener indemne a HarasManager frente a cualquier reclamo, multa, daño, litigio, investigación, sanción o gasto originado por:

* uso indebido del servicio;
* incumplimiento legal;
* violación de derechos de terceros;
* datos cargados por el usuario;
* conflictos entre usuarios u organizaciones.

⸻

13. Propiedad intelectual

Todo el software, código fuente, diseño, marca, documentación, interfaz, base tecnológica y contenido asociado pertenecen a HarasManager.

No se otorga cesión ni transferencia de propiedad intelectual.

El usuario recibe únicamente una licencia limitada, revocable, no exclusiva e intransferible de uso.

⸻

14. Modificaciones

HarasManager podrá modificar:

* funcionalidades;
* estructura;
* precios;
* integraciones;
* presentes Términos.

La continuidad de uso posterior implicará aceptación.

⸻

15. Suspensión y cancelación

HarasManager podrá suspender, limitar o cancelar cuentas inmediatamente, con o sin previo aviso, ante:

* incumplimiento contractual;
* actividad sospechosa;
* riesgos de seguridad;
* fraude;
* uso abusivo;
* requerimiento legal.

La finalización del servicio no obliga a conservar datos indefinidamente.

⸻

16. Ley aplicable y jurisdicción

Estos Términos se regirán por las leyes de la República Argentina.

Toda controversia será sometida a los tribunales ordinarios competentes de la Ciudad Autónoma de Buenos Aires, con renuncia expresa a cualquier otro fuero o jurisdicción.

⸻

17. Contacto

Consultas legales o técnicas:

admin@harasmanager.com
HarasManager
$terminos$,
  true
);
