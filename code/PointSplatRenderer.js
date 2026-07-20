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
                    if (albedo.a <= 0.0) discard;

                    vec3 normal = normalize(texture2D(tNormal, vUv).rgb * 2.0 - 1.0);
                    vec3 lightDirection = normalize(vec3(-0.4, 0.6, 1.0));
                    vec3 viewDirection = vec3(0.0, 0.0, 1.0);
                    vec3 halfDirection = normalize(lightDirection + viewDirection);

                    float diffuse = max(dot(normal, lightDirection), 0.0);
                    float specular = pow(max(dot(normal, halfDirection), 0.0), 32.0);
                    vec3 lighting = 0.15 + diffuse * vec3(0.85) + specular * vec3(0.35);

                    //gl_FragColor = vec4(albedo.rgb * lighting, albedo.a);
                    gl_FragColor = vec4(albedo.rgb, 1.0);
                }
            `
        });
        this.phongPass.uniforms.tAlbedo.value = this.renderTarget.textures[0];
        this.phongPass.uniforms.tNormal.value = this.renderTarget.textures[1];
        this.composer.insertPass(this.phongPass, this.composer.passes.length - 1);

        this.material = new PointSplatMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            blending: THREE.NormalBlending,
            premultipliedAlpha: true,
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