import {GLTFLoader} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/loaders/GLTFLoader.js";
import {OrbitControls} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/controls/OrbitControls.js";
import {Water} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/objects/Water.js";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera( 90, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.z = 6;

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.toneMappingExposure = 20;
renderer.toneMapping = THREE.NoToneMapping;
renderer.antialias = true;

const domEvents = new THREEx.DomEvents(camera, renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.mouseButtons = {
	LEFT: THREE.MOUSE.ROTATE,
	MIDDLE: THREE.MOUSE.DOLLY,
	RIGHT: THREE.MOUSE.ROTATE
}
controls.minDistance = 1;
controls.maxDistance = 100;
controls.maxPolarAngle = Math.PI * 3 / 4;

const listener = new THREE.AudioListener();
camera.add(listener);


document.body.appendChild( renderer.domElement );
window.addEventListener( 'resize', onWindowResize, false );
window.addEventListener( 'click', onUserAction, false );
window.addEventListener( 'touchstart', onUserAction, false );

let button_models = {};
let model_ideal_rotation = {};
let model_text_should_be_visible = {};
let fonts = {};

let analyser;

async function load_texture(path) {
    return new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(path, resolve, undefined, reject);
    });
}
async function load_font(path) {
    // cache fonts since we use the same font multiple times
    if (Object.keys(fonts).includes(path)) {
        return fonts[path];
    } else {
        return new Promise((resolve, reject) => {
            new THREE.FontLoader().load(path, resolve, undefined, reject);
        });
    }
}
async function load_model(path) {
    return new Promise((resolve, reject) => {
        new GLTFLoader().load(path, resolve, undefined, reject);
    });
}
async function load_audio(path) {
    return new Promise((resolve, reject) => {
        new THREE.AudioLoader().load(path, resolve, undefined, reject);
    });
}

async function init() {
    // Create skybox
    const skybox_texture = await load_texture('textures/space.jpg');
    skybox_texture.encoding = THREE.sRGBEncoding;
    const env_map = new THREE.WebGLCubeRenderTarget( skybox_texture.image.height / 2, {
        format: THREE.RGBAFormat,
        generateMipmaps: false,
        magFilter: THREE.LinearFilter,
        minFilter: THREE.LinearFilter
    } ).fromEquirectangularTexture( renderer, skybox_texture ).texture;
    scene.background = env_map;
    scene.envMap = env_map;
    skybox_texture.dispose();

    // Create water
    const water_geometry = new THREE.RingGeometry(0, 500, 128, 64);
    const water_texture = await load_texture('textures/waternormals.jpg');
    water_texture.wrapS = water_texture.wrapT = THREE.RepeatWrapping;
    const water = new Water(
        water_geometry,
        {
            textureWidth: 1024,
            textureHeight: 1024,
            waterNormals: water_texture,
            alpha: 1,
            waterColor: 0xb8001c,
            distortionScale: 0.5,
            fog: scene.fog !== undefined,
            sunDirection: new THREE.Vector3(0, 0, 0),
            sunColor: 0xb8001c
        }
    );
    water.rotation.x = - Math.PI / 2;
    water.position.y = -3;
    water.name = 'water';
    scene.add( water );

    // Create buttons
    async function create_button(model, name, material, position, url, scale=1) {
        console.log(model);
        const group = new THREE.Group();
        group.name = name;
        group.position.x = position.x;
        group.position.y = position.y;
        model_ideal_rotation[name] = {x: 0, y: 0};

        model.material = material;
        model.geometry.scale(scale, scale, scale);
        model.rotation.x = Math.PI / 2;
        group.add(model);

        const bounding_size = new THREE.Box3().setFromObject(model).getSize();

        // add text on mouseover
        const text_material = new THREE.MeshLambertMaterial({
            emissive: 0xffffff,
            emissiveIntensity: 0.8,
            opacity: 0,
            transparent: true,
            depthTest: false
        });
        const font = await load_font('fonts/Roboto_Regular.json');
        const text_geometry = new THREE.TextGeometry(name, {
            font: font,
            size: bounding_size.x / 9,
            height: bounding_size.z / 5
        });
        const text_mesh = new THREE.Mesh(text_geometry, text_material);
        text_geometry.center();
        text_mesh.name = 'text';
        text_mesh.position.x = model.position.x;
        text_mesh.position.z = model.position.z;
        text_mesh.position.y = model.position.y - (bounding_size.y * 11 / 18);
        group.add(text_mesh);
        domEvents.addEventListener(model, 'mousemove touchstart touchmove', function(event) {
            const x = (event.intersect.point.x - (group.position.x + model.position.x)) / bounding_size.x;
            const y = (event.intersect.point.y - (group.position.y + model.position.y)) / bounding_size.y;
            const ideal_x = (-y) * (Math.PI / 6);
            const ideal_y = x * (Math.PI / 6);
            model_ideal_rotation[name].x = ideal_x;
            model_ideal_rotation[name].y = ideal_y;
            model_text_should_be_visible[name] = true;
        });
        domEvents.addEventListener(model, 'mouseout touchend touchcancel', function(event) {
            model_ideal_rotation[name].x = 0;
            model_ideal_rotation[name].y = 0;
            model_text_should_be_visible[name] = false;
        });
        scene.add(group);
        button_models[name] = group;
        THREEx.Linkify(domEvents, model, url, false);
        return true;
    }

    create_button(
        (await load_model('models/soundcloud.glb')).scene.children[0],
        'soundcloud',
        new THREE.MeshStandardMaterial( {
            color: 0xe68200,
            metalness: 1,
            roughness: 0.1,
            envMap: scene.envMap,
            envMapIntensity: 50
        }),
        {
            x: -2,
            y: -2
        },
        'https://soundcloud.com/weebartist/',
        10
    );
    create_button(
        (await load_model('models/spotify.glb')).scene.children[0],
        'spotify',
        new THREE.MeshStandardMaterial( {
            color: 0x00d40e,
            metalness: 1,
            roughness: 0.1,
            envMap: scene.envMap,
            envMapIntensity: 50
        }),
        {
            x: 0,
            y: -2
        },
        'https://open.spotify.com/artist/1syTPWNsXkvNHNSMgl8jll',
        10
    );
    create_button(
        (await load_model('models/bandcamp.glb')).scene.children[0],
        'bandcamp',
        new THREE.MeshStandardMaterial( {
            color: 0x17bdff,
            metalness: 1,
            roughness: 0.1,
            envMap: scene.envMap,
            envMapIntensity: 50
        }),
        {
            x: 2,
            y: -2
        },
        'https://dweeb123.bandcamp.com/',
        10
    );

    // Set up logo/speaker
    const logo_model = (await load_model('models/mercedes_low.glb')).scene.children[0];
    const logo_group = new THREE.Group();
    logo_model.name = 'logo';
    logo_group.name = 'logo_group';
    logo_model.material = new THREE.MeshStandardMaterial({
        color: 0xb31aff,
        metalness: 1,
        roughness: 0.1,
        envMap: scene.envMap,
        envMapIntensity: 50
    });
    logo_model.position.x = 0;
    logo_model.position.y = 1;
    logo_model.rotation.x = Math.PI / 2;
    logo_model.scale.set(0, 0, 0);
    logo_group.add(logo_model);

    const song = new THREE.PositionalAudio(listener);
    new THREE.AudioLoader().load('songs/psycho_trip.opus', function(buffer) {
        song.setBuffer(buffer);
        song.setLoop(true);
        song.setVolume(1);
        song.setRefDistance(50);
        song.play();
        analyser = new THREE.AudioAnalyser(song, 128);
    });
    // We can't add the song directly to the model because
    // it causes an error when the scale of the model changes
    logo_group.add(song);
    scene.add(logo_group);
}

function animate() {
    setTimeout(() => {
        requestAnimationFrame(animate);
    }, 1000 / 60);
    const time = performance.now() * 0.001;
    controls.update();
    for (const name of Object.keys(button_models)) {
        const model = button_models[name];
        // ease button rotation to ideal rotation
        model.rotation.x = (model_ideal_rotation[name].x + model.rotation.x*5) / 6;
        model.rotation.y = (model_ideal_rotation[name].y + model.rotation.y*5) / 6;
        const text = model.getObjectByName('text');
        if (text != undefined) {
            // fade in/out text
            if (model_text_should_be_visible[name]) {
                text.material.opacity = (10*text.material.opacity + 1) / 11;
            } else {
                text.material.opacity = (10*text.material.opacity + 0.0) / 11;
            }
        }
    }
    const logo = scene.getObjectByName('logo');
    const logo_group = scene.getObjectByName('logo_group');
    const water = scene.getObjectByName('water');
    if (water != undefined) {
        water.material.uniforms[ 'time' ].value += 1.0 / 60.0;
    }
    if (logo != undefined && logo_group != undefined && analyser != undefined) {
        const data = analyser.getFrequencyData();
        // average volume across all frequencies
        const volume = data.length > 0 ? data.reduce((a, b) => a+b) / data.length / 100.0 : 0.0;
        logo_group.rotation.y += 0.005;
        logo.scale.set(volume, volume, volume);

        if (water != undefined) {
            const water_geometry = water.geometry;
            for (let i = 0; i < water_geometry.vertices.length; ++i) {
                // mirror frequency data
                let j = (i + 60) % (data.length * 2);
                if (j >= data.length) {
                    j = data.length * 2 - j - 1;
                }
                water_geometry.vertices[i].z = 
                    data[j] / 40                                        // volume of frequency
                    * (i / data.length / 4)                             // distance from center of circle
                    * Math.abs(Math.sin((i / data.length)/64 + time));  // sin wave based on distance from center and time
            }
            water_geometry.verticesNeedUpdate = true;
            water_geometry.normalsNeedUpdate = true;
            water_geometry.computeVertexNormals();
            water_geometry.computeFaceNormals();
        }
    }
    renderer.render( scene, camera );
}

// event handlers
function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

// need this for Chrome autoplay policy
function onUserAction() {
    listener.context.resume();
}

init();
animate();