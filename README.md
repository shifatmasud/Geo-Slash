# Geo-Slash: React 18 3D Game

Three.js 3D geometry slash game inspired by Fruit Ninja, built with React 18, Framer Motion, and Cannon.js.

## Tech Stack

| Category | Details |
| :--- | :--- |
| **Framework** | React 18.2.0 |
| **Build Tool** | Vite |
| **Styling** | CSS-in-JS (JS Objects), Semantic Design Tokens |
| **Animation** | Framer Motion 12.x |
| **Physics** | Cannon-es |
| **3D Engine** | Three.js |
| **Vision** | MediaPipe Tasks Vision |
| **Deployment** | Vercel Ready |

## How to Run

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Start Development Server**
    ```bash
    npm run dev
    ```

3.  **Build for Production**
    ```bash
    npm run build
    ```

## Project Structure

-   **`components/`**: Modular component architecture (`Core`, `Package`, `Section`, `Page`, `App`).
-   **`hooks/`**: Custom React hooks.
-   **`types/`**: TypeScript definitions.
-   **`Theme.tsx`**: Central design system and theme provider.

## Game Features

-   **3D Slicing**: Slash through geometric shapes.
-   **Physics**: Realistic gravity and collisions.
-   **Hand Tracking**: Optional webcam control via MediaPipe.
-   **Meta Prototype**: Edit game config JSON in real-time.
