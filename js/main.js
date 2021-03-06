import {GLTFLoader} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/loaders/GLTFLoader.js";
import {OrbitControls} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/controls/OrbitControls.js";
import {Water} from "https://cdn.rawgit.com/mrdoob/three.js/master/examples/jsm/objects/Water.js";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.set(0, 1, 6);

const renderer = new THREE.WebGLRenderer();
onWindowResize();
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
controls.autoRotate = true;

let listener;

document.getElementById('container').appendChild( renderer.domElement );
window.addEventListener('resize', onWindowResize, false );

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

let song;
async function play_song() {
    if (listener === undefined) {
        listener = new THREE.AudioListener()
        camera.add(listener);
        song = new THREE.PositionalAudio(listener);
        // If browser can play opus, load the opus song file
        // opus is about half the file size of an mp3 with similar quality
        const audioTest = document.createElement('audio');
        let audio_file = 'songs/psycho_trip.mp3';
        if (audioTest.canPlayType('audio/ogg; codecs=opus') === 'probably') {
            audio_file = 'songs/psycho_trip.opus';
        }
        audioTest.remove()
        const audio = await load_audio(audio_file);
        song.setBuffer(audio);
        song.setLoop(true);
        song.setVolume(1);
        song.setRefDistance(10);
        song.setMaxDistance(100);
        song.play();
        analyser = new THREE.AudioAnalyser(song, 128);
        // We can't add the song directly to the model because
        // it causes an error when the scale of the model changes
        // so we add it to a group instead
        const logo_group = scene.getObjectByName('logo_group')
        if (logo_group != undefined) {
            logo_group.add(song);
        }
    } else {
        if (listener.context.state === 'suspended') {
            listener.context.resume()
        }
    }
}

// Need this for browsers that block audio from autoplaying
// not sure which ones are necessary on which browsers ¯\_(ツ)_/¯
document.getElementById('container').addEventListener('click', play_song, false );
document.getElementById('container').addEventListener('touchstart', play_song, false );
document.getElementById('container').addEventListener('touchend', play_song, false );
document.getElementById('container').addEventListener('touchcancel', play_song, false );
document.getElementById('container').addEventListener('mouseup', play_song, false );
document.getElementById('container').addEventListener('touchmove', play_song, false );

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
    water.position.y = -1;
    water.name = 'water';
    scene.add( water );

    // Create buttons
    async function create_button(model, name, material, url, position, rotation, scale=1) {
        const group = new THREE.Group();
        group.position.copy(position);
        group.rotation.copy(rotation);
        const tilt_group = new THREE.Group();
        group.add(tilt_group);
        tilt_group.name = name;
        model_ideal_rotation[name] = {x: 0, y: 0};

        model.material = material;
        model.geometry.center();
        model.geometry.scale(scale, scale, scale);
        model.geometry.rotateX(Math.PI / 2);
        model.position.set(0, 0, 0);
        tilt_group.add(model);

        const bounding_size = new THREE.Vector3();
        new THREE.Box3().setFromObject(model).getSize(bounding_size);

        // add text on mouseover
        const text_material = new THREE.MeshLambertMaterial({
            emissive: 0xffffff,
            emissiveIntensity: 0.8,
            opacity: 0,
            transparent: true,
            depthTest: true
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
        text_mesh.position.copy(model.position);
        text_mesh.position.y -= (bounding_size.y * 11 / 18);
        tilt_group.add(text_mesh);
        domEvents.addEventListener(model, 'mousemove touchstart touchmove', function(event) {
            const pos = model.worldToLocal(event.intersect.point);
            const x = pos.x * model.scale.x;
            const y = pos.y * model.scale.y;
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
        button_models[name] = tilt_group;
        THREEx.Linkify(domEvents, model, url, false);
        return group;
    }

    let buttons_group = new THREE.Group();
    buttons_group.name = 'buttons';

    buttons_group.add(
        await create_button(
            (await load_model('models/soundcloud.glb')).scene.children[0],
            'soundcloud',
            new THREE.MeshStandardMaterial( {
                color: 0xe68200,
                metalness: 1,
                roughness: 0.1,
                envMap: scene.envMap,
                envMapIntensity: 30
            }),
            'https://soundcloud.com/weebartist',
            new THREE.Vector3(0, 0, 2),
            new THREE.Euler(0, 0, 0),
            10
        )
    );
    buttons_group.add(
        await create_button(
            (await load_model('models/spotify.glb')).scene.children[0],
            'spotify',
            new THREE.MeshStandardMaterial( {
                color: 0x00d40e,
                metalness: 1,
                roughness: 0.1,
                envMap: scene.envMap,
                envMapIntensity: 30
            }),
            'https://open.spotify.com/artist/1syTPWNsXkvNHNSMgl8jll',
            new THREE.Vector3(2, 0, 0),
            new THREE.Euler(0, Math.PI / 2, 0),
            10
        )
    );
    buttons_group.add(
        await create_button(
            (await load_model('models/bandcamp.glb')).scene.children[0],
            'bandcamp',
            new THREE.MeshStandardMaterial( {
                color: 0x17bdff,
                metalness: 1,
                roughness: 0.1,
                envMap: scene.envMap,
                envMapIntensity: 30
            }),
            'https://dweeb123.bandcamp.com',
            new THREE.Vector3(-2, 0, 0),
            new THREE.Euler(0, -Math.PI / 2, 0),
            10
        )
    );
    buttons_group.add(
        await create_button(
            (await load_model('models/discord.glb')).scene.children[0],
            'discord',
            new THREE.MeshStandardMaterial( {
                color: 0x7289da,
                metalness: 1,
                roughness: 0.1,
                envMap: scene.envMap,
                envMapIntensity: 30
            }),
            'https://discord.com/invite/jW8969P',
            new THREE.Vector3(0, 0, -2),
            new THREE.Euler(0, Math.PI, 0),
            10
        )
    );
    scene.add(buttons_group);

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
    logo_model.position.set(0, 2, 0);
    logo_model.geometry.rotateX(Math.PI / 2);
    logo_model.scale.set(0, 0, 0);
    logo_group.add(logo_model);

    // If we created the song before loading the model
    // we never added the song to the model
    if (song != undefined) {
        logo_group.add(song);
    }

    scene.add(logo_group);

    play_song();
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
    const buttons = scene.getObjectByName('buttons');
    if (buttons != undefined) {
        buttons.rotation.y += 0.005;
    }
    if (water != undefined) {
        water.material.uniforms[ 'time' ].value += 1.0 / 60.0;
    }
    if (logo != undefined && logo_group != undefined && analyser != undefined) {
        const data = analyser.getFrequencyData();
        // average volume across all frequencies
        const volume = data.length > 0 ? data.reduce((a, b) => a+b) / data.length / 100.0 : 0.0;
        logo_group.rotation.y += 0.0005;
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
    if (window.visualViewport != undefined) {
        camera.aspect = window.visualViewport.width / window.visualViewport.height;
        camera.updateProjectionMatrix();

        renderer.setSize( window.visualViewport.width, window.visualViewport.height );
    } else {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize( window.innerWidth, window.innerHeight );
    }
}

init();
animate();