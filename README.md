## LOKI

[![Made with Vue.js](https://img.shields.io/badge/Made%20with-Vue.js-42b883?style=flat-square&logo=vue.js)](https://vuejs.org)
[![Vite](https://img.shields.io/badge/Vite-Built%20with-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-Styled-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com)

A self-hosted media management and streaming system – built to organize and stream your personal movie collection over
your local network.

## Production

Make sure you have installed docker, docker-compose and make on your machine!

### Installation

```bash
make deploy # build & start all containers

make stop   # stop all container
```

### Usage

The IP address depends on the system on which the project is running.

```bash
http://localhost/        # login page inspired by Disney+
http://localhost/test1   # design inspired by Netflix 
http://localhost/test2   # design inspired by Disney+ 
http://localhost/sandbox # sandbox view to test out new features
```

## Development

### Installation

```bash
cd frontend
npm install # install frontend dependencies

cd backend
npm install # install backend dependencies
```

### Usage

I have some prototypes for the main design of the frontend

```bash
cd frontend

npm run dev

http://localhost:5173/        # login page inspired by Disney+
http://localhost:5173/test1   # design inspired by Netflix 
http://localhost:5173/test2   # design inspired by Disney+
http://localhost:5173/sandbox # sandbox view to test out new features 
```

This project was born from a desire to create a simpler, more personal alternative to existing tools like Plex or
Jellyfin – with full control over my own media.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.