import * as THREE from 'three';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
import { SharedRenderingCode } from './sharedRenderingCode.js';
import { PointSplatMaterial } from './PointSplatMaterial.js';
class PointSplatRenderer {
    constructor(composer, scene, width, height, particles, camera) {
        this.composer = composer;
        this.width = width;
        this.height = height;
        this.scene = scene;
        this.camera = camera;
        this.particles = particles;
        this.sharedRenderingCode = new SharedRenderingCode(this.particles);
        this.renderer = composer.renderer;

        this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
            count: 2,
            depthBuffer: false,
            stencilBuffer: false,
            type: THREE.FloatType,
            format: THREE.RGBAFormat,
            internalFormat: 'RGBA32F',
        });
        this.renderTarget.textures[1].format = THREE.RGBFormat;
        this.renderTarget.textures[1].type = THREE.UnsignedByteType;
        this.renderTarget.textures[1].internalFormat = 'RGB8';

        this.colorTexturePass = new TexturePass(this.renderTarget.textures[0]);
        this.composer.insertPass(this.colorTexturePass, this.composer.passes.length - 1);

        this.material = new PointSplatMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }

    render() {
        const { points, colors } = this.sharedRenderingCode.computeTrailPoints();
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(points.map(p => [p.x, p.y, p.z]).flat(), 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors.map(c => [c.r, c.g, c.b]).flat(), 3));

        const mesh = new THREE.Points(geo, this.material);

        this.scene.add(mesh);

        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);

        this.composer.render();

        this.scene.remove(mesh);

        mesh.geometry.dispose();
    }
}

export { PointSplatRenderer };