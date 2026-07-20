import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SharedRenderingCode } from './sharedRenderingCode.js';
import { PointSplatMaterial } from './PointSplatMaterial.js';
import { TAIL_LENGTH } from './ParticleLogic.js';
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

        const sceneRenderPass = this.composer.passes.find(pass => pass.scene === this.scene);
        if (sceneRenderPass) sceneRenderPass.enabled = false;

        this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
            count: 2,
            depthBuffer: true,
            stencilBuffer: false,
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
        });
        this.renderTarget.textures[1].format = THREE.RGBFormat;
        this.renderTarget.textures[1].type = THREE.UnsignedByteType;
        this.renderTarget.textures[1].internalFormat = 'RGB8';

        const blurRenderTarget = new THREE.WebGLRenderTarget(width, height, {
            depthBuffer: false,
            stencilBuffer: false,
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
        });
        this.blurComposer = new EffectComposer(this.renderer, blurRenderTarget);
        //this.blurPass = this.createBlurShader(width, height);
        //this.blurComposer.addPass(this.blurPass);

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
                    float specular = pow(max(dot(normal, halfDirection), 0.0), 22.0);
                    vec3 lighting = 0.15 + diffuse * vec3(0.85);

                    //albedo = vec4(0.5, 1.0, 0.0, 1.0);
                    //gl_FragColor = vec4(albedo.rgb * 10.0 * lighting + specular * vec3(100.35, 0.0, 0.0), 1.0);
                    gl_FragColor = vec4(albedo.rgb, 1.0);
                }
            `
        });
        this.phongPass.uniforms.tAlbedo.value = this.renderTarget.textures[0];
        this.phongPass.uniforms.tNormal.value = this.renderTarget.textures[1];
        this.composer.insertPass(this.phongPass, this.composer.passes.length - 2);

        this.material = new PointSplatMaterial({
            size: 0.3,
            //scale: 3.0,
            //vertexColors: true,
            //transparent: true,
            blending: THREE.NoBlending,
            depthWrite: true,
            depthTest: true,
            sizeAttenuation: true,
        });

        const vertexCount = this.particles.length * (TAIL_LENGTH - 1);
        this.positions = new Float32Array(vertexCount * 3);
        this.colors = new Float32Array(vertexCount * 4);
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color4', new THREE.Float32BufferAttribute(this.colors, 4));
        this.mesh = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.mesh);
    }

    createBlurShader(width, height) {
        return new ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
                texelSize: { value: new THREE.Vector2(1 / width, 1 / height) }
            },
            vertexShader: `
                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform vec2 texelSize;
                varying vec2 vUv;

                void main() {
                    float weights[5];
                    weights[0] = 1.0;
                    weights[1] = 4.0;
                    weights[2] = 6.0;
                    weights[3] = 4.0;
                    weights[4] = 1.0;

                    vec4 color = vec4(0.0);
                    for (int y = -2; y <= 2; y++) {
                        for (int x = -2; x <= 2; x++) {
                            float weight = weights[x + 2] * weights[y + 2];
                            color += texture2D(tDiffuse, vUv + vec2(float(x), float(y)) * texelSize) * weight;
                        }
                    }
                    gl_FragColor = color / 256.0;
                }
            `
        });
    }

    blur(texture) {
        this.blurPass.uniforms.tDiffuse.value = texture;
        this.blurComposer.render();
        return this.blurComposer.readBuffer.texture;
    }

    render() {

        for (let particleIndex = 0; particleIndex < this.particles.length; particleIndex++) {
            const particle = this.particles[particleIndex];
            for (let i = 0; i < TAIL_LENGTH - 1; i++) {
                let iCircular = (particle.newestIndex + TAIL_LENGTH - i);
                iCircular %= TAIL_LENGTH;
                let brightness = this.sharedRenderingCode.weights[TAIL_LENGTH - i - 1];
                let p2 = particle.oldPositions[iCircular];
                let c2 = particle.oldColors[iCircular];

                const vertexIndex = particleIndex * (TAIL_LENGTH - 1) + i;
                const positionOffset = vertexIndex * 3;
                const colorOffset = vertexIndex * 4;
                this.positions[positionOffset] = p2.x;
                this.positions[positionOffset + 1] = p2.y;
                this.positions[positionOffset + 2] = p2.z;
                this.colors[colorOffset] = c2.r;
                this.colors[colorOffset + 1] = c2.g;
                this.colors[colorOffset + 2] = c2.b;
                this.colors[colorOffset + 3] = brightness;
            }
        }
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color4', new THREE.Float32BufferAttribute(this.colors, 4));

        //this.geometry.attributes.position.needsUpdate = true;
        //this.geometry.attributes.color4.needsUpdate = true;

        this.renderer.setRenderTarget(this.renderTarget);
        const previousClearColor = this.renderer.getClearColor(new THREE.Color());
        const previousClearAlpha = this.renderer.getClearAlpha();
        this.renderer.setClearColor(0.5, 0.5, 0.5, 1.0);
        this.renderer.clear(true, true, false);
        this.renderer.setClearColor(previousClearColor, previousClearAlpha);
        this.renderer.render(this.scene, this.camera);

        this.composer.render();
    }
}

export { PointSplatRenderer };