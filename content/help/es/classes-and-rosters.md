---
title: Crear una clase e importar su lista de estudiantes
summary: Crea una clase, agrega a sus estudiantes desde una hoja de cálculo y añade a un co-docente.
roles: [teacher, admin]
group: Personas y clases
features: [class-assessments]
order: 11
checked: 2026-11-11
reviewed: false
---
## Crear una clase

1. Abre [ui: Clases] y busca [ui: Nueva clase].
2. Ingresa el [ui: Nombre de la clase], por ejemplo, "CS 341, Fall 2026". El programa y el año de graduación son opcionales.
3. Selecciona [ui: Crear clase]. Serás el propietario de la clase.

## Importar la lista de estudiantes

En la página de la clase, usa [ui: Importar lista de estudiantes]. Elige un [ui: Archivo CSV] o usa [ui: O pega las filas] y luego selecciona [ui: Importar].

El archivo debe tener una fila de encabezado con estas columnas:

- `name` y `email` (obligatorias)
- `roll_number` y `branch` (opcionales)

Por ejemplo:

`name,email,roll_number`

`Priya Raman,priya@college.edu,CS-101`

Si hay un problema con alguna fila, no se importa nada y se indica cada problema junto con su número de fila para que puedas corregir el archivo e importarlo de nuevo. Los archivos pueden tener hasta 5 MB.

Los estudiantes inician sesión con la dirección de correo electrónico que aparece en la lista. La clase muestra quién ha iniciado sesión.

## Añadir un co-docente

En [ui: Añadir un docente colaborador], elige a un docente de tu institución que ya haya iniciado sesión y selecciona [ui: Añadir docente]. Los co-docentes pueden ver a los estudiantes y el trabajo de la clase, y revisarlos y tomar decisiones.

> Para asignar una evaluación a la clase, usa [ui: Asignar una evaluación a esta clase] en la página de la clase. Consulta [Asignar una evaluación a una clase](/help/give-to-a-class).
