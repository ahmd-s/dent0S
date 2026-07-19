'use client'

import dynamic from 'next/dynamic'
import { Suspense, useMemo } from 'react'

/**
 * Inner scene is loaded only on the client via next/dynamic ({ ssr: false }).
 * Three.js touches `window`, so these imports must not run during SSR.
 */
const STLCanvas = dynamic(
  async () => {
    const { Canvas, useLoader } = await import('@react-three/fiber')
    const { OrbitControls } = await import('@react-three/drei')
    // STLLoader lives in three.js (not drei). Path @react-three/drei/loaders/STLLoader does not exist.
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js')
    const THREE = await import('three')

    function STLModel({ url }) {
      const geometry = useLoader(STLLoader, url)

      const { offset, scale } = useMemo(() => {
        geometry.computeBoundingBox()
        const box = geometry.boundingBox
        const center = new THREE.Vector3()
        const size = new THREE.Vector3()
        box.getCenter(center)
        box.getSize(size)
        const maxDim = Math.max(size.x, size.y, size.z) || 1
        // Camera at z=100, fov 50 → fit model comfortably in frame
        return {
          offset: [-center.x, -center.y, -center.z],
          scale: 60 / maxDim,
        }
      }, [geometry])

      return (
        <mesh geometry={geometry} position={offset} scale={scale}>
          <meshStandardMaterial color="#f0f0f0" roughness={0.4} metalness={0.1} />
        </mesh>
      )
    }

    function STLCanvasInner({ url }) {
      return (
        <Canvas camera={{ position: [0, 0, 100], fov: 50 }} style={{ width: '100%', height: '100%' }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 10]} intensity={0.8} />
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
          <Suspense fallback={null}>
            <STLModel url={url} />
          </Suspense>
        </Canvas>
      )
    }

    return STLCanvasInner
  },
  { ssr: false }
)

export default function STLViewer({ url, height = '400px' }) {
  if (!url) {
    return <p style={{ color: '#6b7280', fontSize: 14 }}>No 3D file uploaded yet.</p>
  }

  return (
    <div
      style={{
        height,
        width: '100%',
        background: '#f9fafb',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <STLCanvas url={url} />
    </div>
  )
}
