//import { AudioThreadManager } from "./AudioThreadManager.js";
import * as THREE from 'three'
import * as SimplexNoise from 'simplex-noise';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { DotScreenPass } from 'three/addons/postprocessing/DotScreenPass.js';
import { MaskPass, ClearMaskPass } from 'three/addons/postprocessing/MaskPass.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';

import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

import { BleachBypassShader } from 'three/addons/shaders/BleachBypassShader.js';
import { ColorifyShader } from 'three/addons/shaders/ColorifyShader.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';
import { SepiaShader } from 'three/addons/shaders/SepiaShader.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';
import Stats from 'three/addons/libs/stats.module.js';

import * as MetaAILineRenderer from './MetaAILineRenderer.js';

const noise3D = SimplexNoise.createNoise3D();

function curlNoise3D(dstVector, x, y, z, noiseFn, eps = 1e-4) {
    // Partial derivatives using central differences
    const dx = eps, dy = eps, dz = eps;

    // Noise field components
    //const Fx = noiseFn(x, y, z);
    //const Fy = noiseFn(y + 100, z + 100, x + 100);
    //const Fz = noiseFn(z + 200, x + 200, y + 200);

    // dFz/dy
    const dFz_dy = (noiseFn(z + 200, x + 200, y + 200 + dy) - noiseFn(z + 200, x + 200, y + 200 - dy)) / (2 * dy);
    // dFy/dz
    const dFy_dz = (noiseFn(y + 100, z + 100 + dz, x + 100) - noiseFn(y + 100, z + 100 - dz, x + 100)) / (2 * dz);

    // dFx/dz
    const dFx_dz = (noiseFn(x, y, z + dz) - noiseFn(x, y, z - dz)) / (2 * dz);
    // dFz/dx
    const dFz_dx = (noiseFn(z + 200 + dx, x + 200, y + 200) - noiseFn(z + 200 - dx, x + 200, y + 200)) / (2 * dx);

    // dFy/dx
    const dFy_dx = (noiseFn(y + 100 + dx, z + 100, x + 100) - noiseFn(y + 100 - dx, z + 100, x + 100)) / (2 * dx);
    // dFx/dy
    const dFx_dy = (noiseFn(x, y + dy, z) - noiseFn(x, y - dy, z)) / (2 * dy);

    dstVector.set(
        dFz_dy - dFy_dz,
        dFx_dz - dFz_dx,
        dFy_dx - dFx_dy
    );
}

const TAIL_LENGTH = 100;
const LIFESPAN = 1000;
class Particle {
    constructor() {
        this.oldPositions = new Array(TAIL_LENGTH);
        this.oldColors = new Array(TAIL_LENGTH);
        for (let i = 0; i < TAIL_LENGTH; i++) {
            this.oldPositions[i] = new THREE.Vector3();
            this.oldColors[i] = new THREE.Color();
        }
        this.velocity = new THREE.Vector3();
        this.newestIndex = 0;
        this.reinit();
    }
    reinit() {
        this.age = 0;

        let positionRef = this.oldPositions[this.newestIndex];
        positionRef.set(Math.random(), Math.random(), Math.random());
        positionRef.subScalar(0.5);
        this.remainingLife = Math.floor(Math.random() * LIFESPAN);

        for (let i = 0; i < TAIL_LENGTH; i++) {
            this.update();
        }
    }
    update() {
        let position = this.oldPositions[this.newestIndex];
        let colorRef = this.oldColors[this.newestIndex];
        
        this.newestIndex = (this.newestIndex + 1) % TAIL_LENGTH;
        let noiseScale = 0.3;
        curlNoise3D(this.velocity, position.x * noiseScale, position.y * noiseScale, position.z * noiseScale, noise3D);
        this.velocity.multiplyScalar(0.01);
        colorRef.setHSL((Math.atan2(this.velocity.y, this.velocity.x)/Math.PI+1)*.5, 1, 0.5);
        this.oldPositions[this.newestIndex].copy(position);
        this.oldPositions[this.newestIndex].add(this.velocity);
        this.age++;
        this.remainingLife--;
    }
    dispose() {
        this.material.dispose();
    }
}

export class App {
    particles = [];
    constructor() {
        this.lastTime = 0;

        //!!!!!!!!!!!!!!!!!!
        this.stats = new Stats();
        document.body.appendChild( this.stats.dom );
        //!!!!!!!!!!!!!!!!!!

        for (let i = 0; i < 100; i++) {
            this.particles.push(new Particle());
        }

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
        window.r=this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        document.body.appendChild( this.renderer.domElement );
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        
        this.camera.position.z = 1;
        this.controls.update();

        this.lineMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            vertexColors: true
        });


        this.composer = new EffectComposer( this.renderer );
        this.composer.addPass( new RenderPass( this.scene, this.camera ) );
       
		/*let bleachBypassPass = new ShaderPass( BleachBypassShader );
        bleachBypassPass.uniforms['opacity'].value = 0.8;
        //bleachBypassPass.
        this.composer.addPass( bleachBypassPass );*/
        if(false)this.composer.addPass( new BokehPass( this.scene, this.camera, {
            focus: 0.5,
            aperture: 5*0.00001,
            maxblur: 0.01,
            width: window.innerWidth,
            height: window.innerHeight
        } ) );
		this.composer.addPass( new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 0.3, 0.5, 0.5 ) );
        this.composer.addPass( new OutputPass() );

        if ( false&&this.renderer.getContext() instanceof WebGL2RenderingContext ) {
            this.composer.renderTarget1.samples = 8;
            this.composer.renderTarget2.samples = 8;
        }
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.1;
        //this.renderer.toneMapping = THREE.LinearToneMapping
        //this.renderer.setPixelRatio(0.5);
        
        // triple buffering for Intel GPU framedropping
        this.line1 = this.createLineStrip();
        this.line2 = this.createLineStrip();
        
        this.weights = [];
        for(let i=0;i<TAIL_LENGTH;i++){
            let iNormalized = 1.0-i/(TAIL_LENGTH-1);
            let brightness = Math.exp(-iNormalized*2.0);
            let add = i==TAIL_LENGTH-2||i==TAIL_LENGTH-1?100.5:0.0;
            brightness += add;
            this.weights.push(brightness);
        }

        
        this.lineToRender = this.line1;
        this.lineToWriteTo = this.line2;

        //this.renderer.setAnimationLoop( this.animate.bind(this) );
        //this.animate();

        requestAnimationFrame( this.animate.bind(this) );
        //window.setInterval( this.animate.bind(this), 1000/60 );
    }

    createLineStrip() {
        const positions = new Float32Array( TAIL_LENGTH*this.particles.length * 3 * 2 );
        const colors = new Float32Array( TAIL_LENGTH*this.particles.length * 3 * 2);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.lxMonkeyPatch = {
            positions: positions,
            colors: colors
        }

        const lineStrip = new THREE.Mesh( geometry, this.lineMaterial );
        return lineStrip;
    }
    
    animate(time) {
        this.controls.update();

        let positionIndex = 0; // vertex index

        for(let particleIndex=0;particleIndex<this.particles.length;particleIndex++){
            let particle = this.particles[particleIndex];
            if (particle.remainingLife == 0) {
                particle.reinit();
            }
            particle.update();
        }

        const points = [];
        const colors = [];

        for(const particle of this.particles){
            const firstPoint = particle.oldPositions[(particle.newestIndex + 1) % TAIL_LENGTH];
            points.push(new THREE.Vector3(firstPoint.x, firstPoint.y, firstPoint.z));
            colors.push(new THREE.Color(0, 0, 0));
            points.push(new THREE.Vector3(firstPoint.x, firstPoint.y, firstPoint.z));
            colors.push(new THREE.Color(0, 0, 0));
            for(let i=0;i<TAIL_LENGTH;i++){
                let iCircular = (particle.newestIndex + TAIL_LENGTH - i);
                iCircular %= TAIL_LENGTH;
                let iPrevCircular = particle.newestIndex + TAIL_LENGTH - i - 1;
                iPrevCircular %= TAIL_LENGTH;
                let brightness = this.weights[TAIL_LENGTH-i-1];
                let p1 = particle.oldPositions[iPrevCircular];
                let c1 = particle.oldColors[iPrevCircular];
                let p2 = particle.oldPositions[iCircular];
                let c2 = particle.oldColors[iCircular];
                const r = c2.r * brightness;
                const g = c2.g * brightness;
                const b = c2.b * brightness;
                
                points.push(new THREE.Vector3(p2.x, p2.y, p2.z));
                colors.push(new THREE.Color(r, g, b));
            }
            const lastPoint = points[points.length-1];
            points.push(new THREE.Vector3(lastPoint.x, lastPoint.y, lastPoint.z));
            colors.push(new THREE.Color(0, 0, 0));
            points.push(new THREE.Vector3(lastPoint.x, lastPoint.y, lastPoint.z));
            colors.push(new THREE.Color(0, 0, 0));
       }
        const geo = MetaAILineRenderer.beveledLineNoOverlap(points, colors, z => z * 0.02); // width depends on z

        const mesh = new THREE.Mesh(geo, this.lineMaterial);
        
        this.scene.add(mesh);

        this.composer.render();
        
        this.scene.remove( mesh );

        mesh.geometry.dispose();
        mesh.material.dispose();
        
        this.stats.update();

        requestAnimationFrame( this.animate.bind(this) );
    }
}
