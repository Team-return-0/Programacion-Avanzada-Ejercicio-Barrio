# Programacion-Avanzada-Ejercicio-Barrio
# Elección del mejor barrio
**Nivel 3 - Problema 1 | Certamen Nacional 2008 | Archivo: `barrio` | Versión 1.3**  
*Contribución de Hugo Ryckeboer*

---

## Descripción del problema

Un hombre se muda a otra ciudad y decide comprar una vivienda. Quiere instalarse en un barrio tranquilo.

Sabe que hospitales, iglesias, supermercados y otras actividades hacen que muchas personas se muevan en su vecindad y quitan la tranquilidad en sus cercanías.

Para orientar su elección de barrio quiere ubicarse en una zona que maximiza la distancia a cualquiera de estas actividades multitudinarias.

La ciudad donde piensa instalarse tiene forma de cuadrícula con $M$ calles que corren de Oeste a Este, numeradas de $1$ a $M$ y $N$ de Sur a Norte numeradas de $1$ a $N$.

Hizo registrar la esquina más cercana a cada una de las actividades multitudinarias.

Se pide que escribas un programa `barrio.c`, `barrio.pas` o `barrio.cpp` que ayude a determinar cuáles son las esquinas más alejadas de cualquiera de esas esquinas que registran actividades multitudinarias.

Las distancias se miden por la cantidad de cuadras.

## Datos de entrada

Se recibe un archivo `barrio.in` del directorio actual, que contiene:

* **Primer renglón:** Los números $M$ y $N$ que expresan el tamaño de la cuadrícula y el número $K$, la cantidad de esquinas multitudinarias registradas.
* **En los siguientes $K$ renglones:** Vienen las coordenadas, primero, el número $x$ que indica la calle en el sentido Sur-Norte ($1 \le x \le N$), luego, separado por un espacio, el número $y$ que indica la calle en el sentido Oeste-Este ($1 \le y \le M$).

## Datos de salida

El programa debe generar en el directorio actual el archivo `barrio.out` con:

* Una línea con un entero indicando cuánto es la máxima distancia que logra distanciarse en esa ciudad de las esquinas tumultuosas.
* Una línea que indique cuántas son las esquinas que cumplen la condición de maximizar la distancia a la esquina tumultuosa más cercana.
* Tantas líneas como esquinas se hayan indicado en la segunda línea con las coordenadas de cada una de las esquinas que cumplen la condición.

## Puntuación parcial

La solución correcta de la primera o segunda línea de la respuesta valen 30 puntos cada una.

## Ejemplo

En el caso de que el archivo `barrio.in` contenga:

```text
10 8 3
8 5
1 7
4 2
```

El archivo `barrio.out` deberá contener:

```text
6
1
10 1
```

---

# Anexo: 2008 - Elección del mejor barrio (cortes e intensidades)

**Enunciado:** `2008 - elección del mejor barrio.pdf`

## Cambios

Hay $B$ cuadras cortadas que no se pueden transitar, y cada esquina tumultuosa tiene una intensidad $v$ ($0 \le v \le 1000$). 

Su molestia en una esquina se mide como la distancia en cuadras (sin pasar por cuadras cortadas) menos $v$. Se buscan las esquinas que maximizan la menor molestia. 

La entrada trae $v$ junto a cada esquina tumultuosa y, después, $B$ y las $B$ cuadras cortadas, cada una como dos esquinas vecinas. 

**Cotas:** $M, N \le 1000$, $K \le 100.000$. Se garantiza que toda esquina es alcanzable desde alguna tumultuosa.

## Formato de Entrada (Modificado)

`M N K`, $K$ líneas `x y v`, `B` y $B$ líneas `x1 y1 x2 y2`. Igual que en el ejemplo original, $x$ va de $1$ a $M$ e $y$ de $1$ a $N$.

## Ejemplo (Modificado)

**Entrada:**
```text
10 8 3
8 5 2
1 7 0
4 2 5
4
7 2 7 3
9 5 10 5
9 6 9 7
8 5 8 6
```

**Salida:**
```text
4
1
9 8
```
