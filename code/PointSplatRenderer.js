import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
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

        this.phongPass = new ShaderPass({
            uniforms: {
                tAlbedo: { value: null },
                tNormal: { value: null }
            },
            vertexShader: `
                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tAlbedo;
                uniform sampler2D tNormal;
                varying vec2 vUv;

                void main() {
                    vec4 albedo = texture2D(tAlbedo, vUv);
                    vec3 normal = texture2D(tNormal, vUv).rgb * 2.0 - 1.0;
                    if (length(normal) < 0.1) {
                        gl_FragColor = vec4(10.5, 0.5, 0.5, 1.0);
                        return;
                    }

                    normal = normalize(normal);
                    vec3 lightDirection = normalize(vec3(-0.4, 0.6, 1.0));
                    vec3 viewDirection = vec3(0.0, 0.0, 1.0);
                    vec3 halfDirection = normalize(lightDirection + viewDirection);

                    float diffuse = max(dot(normal, lightDirection), 0.0);
                    float specular = pow(max(dot(normal, halfDirection), 0.0), 52.0);
                    vec3 lighting = 0.15 + diffuse * vec3(0.85);

                    //albedo = vec4(0.5, 1.0, 0.0, 1.0);
                    gl_FragColor = vec4(albedo.rgb * 10.0 * lighting + specular * vec3(10.35), albedo.a);
                    //gl_FragColor = vec4(normal, 1.0);
                }
            `
        });
        this.phongPass.uniforms.tAlbedo.value = this.renderTarget.textures[0];
        this.phongPass.uniforms.tNormal.value = this.renderTarget.textures[1];
        this.composer.insertPass(this.phongPass, this.composer.passes.length - 2);

        this.material = new PointSplatMaterial({
            size: 0.3,
            vertexColors: true,
            transparent: true,
            blending: THREE.NormalBlending,
            premultipliedAlpha: true,
            depthWrite: false
        });
    }

    render() {
        const verts = this.sharedRenderingCode.computeTrailPoints();
        const viewMatrix = this.camera.matrixWorldInverse.elements;
        verts.sort((a, b) => {
            const aPosition = a.position;
            const bPosition = b.position;
            const aDepth = viewMatrix[2] * aPosition.x + viewMatrix[6] * aPosition.y + viewMatrix[10] * aPosition.z + viewMatrix[14];
            const bDepth = viewMatrix[2] * bPosition.x + viewMatrix[6] * bPosition.y + viewMatrix[10] * bPosition.z + viewMatrix[14];
            return aDepth - bDepth;
        });

        const positions = new Float32Array(verts.length * 3);
        const colors = new Float32Array(verts.length * 3);
        for (let i = 0; i < verts.length; i++) {
            const position = verts[i].position;
            const color = verts[i].color;
            const offset = i * 3;
            positions[offset] = position.x;
            positions[offset + 1] = position.y;
            positions[offset + 2] = position.z;
            colors[offset] = color.r;
            colors[offset + 1] = color.g;
            colors[offset + 2] = color.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const mesh = new THREE.Points(geo, this.material);

        this.scene.add(mesh);

        this.renderer.setRenderTarget(this.renderTarget);
        /*const previousClearColor = this.renderer.getClearColor(new THREE.Color());
        const previousClearAlpha = this.renderer.getClearAlpha();
        this.renderer.setClearColor(0.5, 0.5, 0.5, 1.0);
        this.renderer.clear(true, false, false);
        this.renderer.setClearColor(previousClearColor, previousClearAlpha);*/
        this.renderer.render(this.scene, this.camera);

        this.composer.render();

        this.scene.remove(mesh);

        mesh.geometry.dispose();
    }
}

export { PointSplatRenderer };