# Arquero vs Murciélagos - Juego Multijugador

Un juego 3D de arqueros contra murciélagos con soporte multijugador en tiempo real.

## Instrucciones de juego

- **Movimiento**: Teclas WASD
- **Apuntar**: Flechas del teclado o movimiento del ratón
- **Disparar**: Barra espaciadora o clic del ratón
- **Cambiar vista**: Tecla V para alternar entre primera y tercera persona

## Objetivo

Eliminar la mayor cantidad de murciélagos posible antes de que te alcancen. Cada murciélago eliminado otorga 10 puntos. El juego termina cuando un murciélago logra tocarte.

## Cómo desplegarlo gratuitamente en Vercel

### Requisitos previos
- Una cuenta en [GitHub](https://github.com/)
- Una cuenta en [Vercel](https://vercel.com/) (puedes registrarte con tu cuenta de GitHub)

### Pasos para desplegar

1. **Sube el código a un repositorio de GitHub**
   - Crea un nuevo repositorio en GitHub
   - Sube todos los archivos de este proyecto al repositorio

2. **Despliega en Vercel**
   - Inicia sesión en Vercel con tu cuenta de GitHub
   - Haz clic en "New Project"
   - Selecciona el repositorio que acabas de crear
   - Vercel detectará automáticamente la configuración de Node.js
   - Haz clic en "Deploy"

3. **Verifica el despliegue**
   - Una vez que Vercel termine el despliegue, te proporcionará una URL
   - Abre la URL en tu navegador para probar el juego

## Desarrollo local

Para ejecutar el juego localmente:

1. Instala las dependencias:
   ```
   npm install
   ```

2. Inicia el servidor de desarrollo:
   ```
   npm run dev
   ```

3. Abre tu navegador en [http://localhost:3000](http://localhost:3000)

## Tecnologías utilizadas

- Three.js para gráficos 3D
- Socket.io para comunicación en tiempo real
- Node.js y Express para el servidor
- Vercel para el despliegue

## Características multijugador

- Juega con amigos en tiempo real
- Ve a otros jugadores moverse por el mapa
- Compite por la puntuación más alta
- Colabora para eliminar murciélagos

## Características

- Vista de águila (bird's eye view)
- Gráficos 3D con Three.js
- Enemigos que te persiguen
- Sistema de puntuación
- Dificultad progresiva (los murciélagos aparecen cada vez más rápido)

¡Diviértete jugando! 