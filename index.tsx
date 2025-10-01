/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {createRoot} from 'react-dom/client';
// Fix: Correct import based on guidelines, including Modality where needed.
import {GoogleGenAI, Modality} from '@google/genai';

// --- CONSTANTS & TYPES ---
type Page = 'home' | 'pose' | 'prop' | 'design' | 'creative' | 'stylist' | 'architect' | 'video' | 'magic' | 'background' | 'trendko' | 'batch' | 'lookbook' | 'placement' | 'upscale' | 'comic';
type Theme = 'light' | 'dark';
type Language = 'en' | 'vi';
type ControlMode = 'Pose' | 'Edge' | 'Depth' | 'Creative';
type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';
type VideoGenerationMode = 'text' | 'image';
type VideoAspectRatio = '9:16' | '16:9' | '1:1';
type VideoQuality = '720p' | '1080p';

interface UploadedImage {
    apiPayload: {
        inlineData: {
            data: string;
            mimeType: string;
        }
    };
    dataUrl: string;
}

const APP_NAME = 'AI Magic Tool Studio';

interface StructuredPreset {
  label: {[key in Language]: string};
  style: string;
  camera: string;
  lighting: string;
  mood: string;
  aspect?: string;
  beauty: 'on' | 'off';
}

const UPSCALE_FORMULA = {
  skin_library: {
    "Beauty_Smooth": {
      "name": "Beauty Smooth – Flawless Commercial",
      "skin_render": "Her skin is smooth and radiant, with flawless texture. Any blemishes, scars or pores are invisible under beauty light and gentle cinematic grading. The surface reflects soft light evenly, with glass-skin shine and creamy finish."
    },
    "High_Fidelity_Realism": {
      "name": "High-Fidelity Realism – Cinematic Natural Detail",
      "skin_render": "Her skin has ultra-high fidelity cinematic rendering with soft light diffusion. Subtle peach fuzz and delicate micro-textures are preserved under close-up focus, giving natural realism without visible blemishes. Surface reflectivity is balanced: soft glow with gentle sheen on highlights, avoiding over-plastic shine. Tonal gradients transition smoothly, showing lifelike depth and softness, maintaining a natural creamy radiance."
    },
    "Hybrid_Luxury": {
      "name": "Hybrid Luxury – Glossy but Natural",
      "skin_render": "Her skin is luminous and radiant with luxury cinematic grading, combining flawless smoothness with subtle micro-textures. Under soft diffusion light, fine peach fuzz is preserved, adding realism without imperfections. The surface reflects a creamy glow with balanced highlights, avoiding plastic shine. This rendering merges glossy commercial beauty aesthetics with the authenticity of high-fidelity cinematic portraiture."
    }
  },
  "upscale_pipeline": {
    "explain": "Enable multi-stage super-resolution pipeline with face-preserve. First upscale 2x for detail recovery, then cascade 4x for texture fidelity, and finalize at 8x for ultra-sharp output.",
    "rules": [
      "Stage 1: Upscale 2x – recover soft details (skin gradients, hair flow, light diffusion).",
      "Stage 2: Upscale 4x – enhance micro textures (peach fuzz, fabric weave, jewelry shine).",
      "Stage 3: Upscale 8x – finalize ultra-sharp 8K output while preserving cinematic tone.",
      "Always enable face-preserve to avoid distortion of characters.",
      "Do not separate audio layer when upscaling for video projects."
    ],
    "render_block": {
      "resolution": "8K",
      "frame_rate": "24fps",
      "upscale": "Enable multi-stage super-resolution pipeline with face-preserve. First upscale 2x for detail recovery, then cascade 4x for texture fidelity, and finalize at 8x for ultra-sharp output. Preserve micro details such as peach fuzz and fabric texture. Do not separate audio layer when upscaling."
    }
  }
};


const PRESET_CONTROLLER = {
    quality_block: 'ultra-high detail, professional grade, 8K native resolution (8192x8192 pixels), ACES-like cinematic tone mapping, maximum detail preservation, no upscaling. The final output must be extremely high-resolution.',
    global_defaults: {
        render: { resolution: '8192x8192' },
        aspect_fallback: '1:1',
        color_pipeline: 'ACES-cinematic',
        noise_floor: '0.01',
    },
    generation_instruction: 'Generate a single, rasterized image based on the user\'s input images and the detailed prompt. Adhere strictly to all quality, global, and preset parameters. Output only the image.',
};

const PRESETS: Record<string, StructuredPreset> = {
    'portrait-studio': {
        label: { en: 'Portrait: Studio', vi: 'Chân dung: Studio' },
        style: 'classic, clean, professional',
        camera: '85mm f/1.4 lens, shallow depth of field, sharp focus on eyes',
        lighting: 'three-point setup, softbox key light, subtle rim light',
        mood: 'elegant, timeless, focused',
        aspect: '3:4',
        beauty: 'on',
    },
    'portrait-outdoor-sunny': {
        label: { en: 'Portrait: Outdoor Sunny', vi: 'Chân dung: Ngoài trời nắng' },
        style: 'natural, vibrant, lifestyle',
        camera: '50mm f/1.8, bokeh background, natural framing',
        lighting: 'golden hour sunlight, warm tones, lens flare',
        mood: 'happy, bright, energetic',
        aspect: '3:4',
        beauty: 'on',
    },
    'portrait-outdoor-overcast': {
        label: { en: 'Portrait: Outdoor Overcast', vi: 'Chân dung: Ngoài trời u ám' },
        style: 'soft, diffused, moody',
        camera: '85mm f/1.8, medium depth of field',
        lighting: 'overcast day, soft natural light, even skin tones',
        mood: 'calm, introspective, gentle',
        aspect: '3:4',
        beauty: 'on',
    },
    'fashion-editorial': {
        label: { en: 'Fashion: Editorial', vi: 'Thời trang: Tạp chí' },
        style: 'high fashion, avant-garde, dynamic',
        camera: '35mm or 50mm lens, full-body shots, unconventional angles',
        lighting: 'hard light, dramatic shadows, styled studio lighting',
        mood: 'confident, powerful, artistic',
        aspect: '4:5',
        beauty: 'on',
    },
    'fashion-beauty-commercial': {
        label: { en: 'Fashion: Beauty Commercial', vi: 'Thời trang: Quảng cáo Beauty' },
        style: 'clean, flawless, polished',
        camera: '100mm macro lens, close-up on face, perfect skin texture',
        lighting: 'ring light or beauty dish, no shadows, bright and clean',
        mood: 'luxurious, perfect, radiant',
        aspect: '1:1',
        beauty: 'on',
    },
    'lifestyle-street': {
        label: { en: 'Lifestyle: Street', vi: 'Đời thường: Đường phố' },
        style: 'candid, authentic, urban',
        camera: '28mm or 35mm lens, reportage style, capturing moments',
        lighting: 'natural city light, reflections, neon signs at night',
        mood: 'real, energetic, spontaneous',
        aspect: '16:9',
        beauty: 'off',
    },
    'lifestyle-corporate': {
        label: { en: 'Lifestyle: Corporate', vi: 'Đời thường: Doanh nghiệp' },
        style: 'professional, modern, clean',
        camera: '50mm lens, environmental portraits in an office setting',
        lighting: 'soft window light or professional strobes, clean and bright',
        mood: 'successful, confident, approachable',
        aspect: '3:2',
        beauty: 'off',
    },
    'fine-art-drama': {
        label: { en: 'Fine Art: Drama', vi: 'Nghệ thuật: Kịch tính' },
        style: 'painterly, emotional, chiaroscuro',
        camera: '50mm prime lens, deliberate composition',
        lighting: 'single light source, deep shadows, high contrast',
        mood: 'intense, soulful, mysterious',
        aspect: '4:5',
        beauty: 'off',
    },
    'fine-art-bw': {
        label: { en: 'Fine Art: Black & White', vi: 'Nghệ thuật: Đen trắng' },
        style: 'timeless, graphic, minimalist',
        camera: 'various lenses, focus on texture, shape, and form',
        lighting: 'high contrast, directional light to create shapes',
        mood: 'classic, emotional, profound',
        aspect: '1:1',
        beauty: 'off',
    },
    'landscape-nature': {
        label: { en: 'Landscape: Nature', vi: 'Phong cảnh: Thiên nhiên' },
        style: 'epic, breathtaking, vibrant',
        camera: '16-35mm wide-angle lens, deep depth of field, leading lines',
        lighting: 'sunrise or sunset, dramatic sky, atmospheric conditions',
        mood: 'majestic, peaceful, wild',
        aspect: '16:9',
        beauty: 'off',
    },
    'landscape-cityscape': {
        label: { en: 'Landscape: Cityscape', vi: 'Phong cảnh: Thành phố' },
        style: 'dynamic, modern, futuristic',
        camera: 'wide-angle lens, long exposure for light trails',
        lighting: 'blue hour, city lights, reflections on wet streets',
        mood: 'vibrant, bustling, impressive',
        aspect: '16:9',
        beauty: 'off',
    },
    'landscape-epic-fantasy': {
        label: { en: 'Landscape: Epic Fantasy', vi: 'Phong cảnh: Giả tưởng Sử thi' },
        style: 'painterly, grand scale, imaginative, Lord of the Rings inspired',
        camera: 'ultra-wide lens, dramatic perspective, leading lines into mythical structures',
        lighting: 'god rays, magical glowing elements, dramatic storm clouds, sunrise/sunset',
        mood: 'awe-inspiring, adventurous, mythical, ancient',
        aspect: '16:9',
        beauty: 'off',
    },
    'architecture-exterior': {
        label: { en: 'Architecture: Exterior', vi: 'Kiến trúc: Ngoại thất' },
        style: 'clean, geometric, powerful',
        camera: 'tilt-shift lens to correct perspective, sharp focus',
        lighting: 'bright daylight to create strong lines and shadows',
        mood: 'minimalist, grand, structured',
        aspect: '4:5',
        beauty: 'off',
    },
    'architecture-interior': {
        label: { en: 'Architecture: Interior', vi: 'Kiến trúc: Nội thất' },
        style: 'warm, inviting, well-designed',
        camera: 'ultra-wide lens, one-point perspective, focus on details',
        lighting: 'ambient light, soft window light, warm artificial lights',
        mood: 'cozy, elegant, spacious',
        aspect: '4:3',
        beauty: 'off',
    },
    'product-commercial': {
        label: { en: 'Product: Commercial', vi: 'Sản phẩm: Thương mại' },
        style: 'sleek, desirable, high-end',
        camera: '100mm macro lens, focus stacking for ultimate sharpness',
        lighting: 'studio lighting, gradient backgrounds, perfect reflections',
        mood: 'premium, clean, attractive',
        aspect: '1:1',
        beauty: 'off',
    },
    'product-food': {
        label: { en: 'Product: Food', vi: 'Sản phẩm: Ẩm thực' },
        style: 'delicious, fresh, appetizing',
        camera: 'macro lens, focus on texture, shallow depth of field',
        lighting: 'soft natural light, backlight to show steam or texture',
        mood: 'tasty, rustic, vibrant',
        aspect: '4:5',
        beauty: 'off',
    },
    'product-food-dark': {
        label: { en: 'Product: Food (Dark & Moody)', vi: 'Sản phẩm: Ẩm thực (Tối & Sâu lắng)' },
        style: 'dramatic, textured, rustic, chiaroscuro',
        camera: 'macro lens, tight crop, shallow depth of field',
        lighting: 'single directional light source from the side or back, deep shadows',
        mood: 'rich, artisanal, sophisticated, tempting',
        aspect: '4:5',
        beauty: 'off',
    },
    'product-macro': {
        label: { en: 'Product: Macro', vi: 'Sản phẩm: Cận cảnh' },
        style: 'detailed, intricate, abstract',
        camera: 'true macro 1:1 lens, extreme close-up',
        lighting: 'specialized ring or twin lights to illuminate tiny details',
        mood: 'fascinating, scientific, beautiful',
        aspect: '1:1',
        beauty: 'off',
    },
    'special-night-street': {
        label: { en: 'Special: Night Street', vi: 'Đặc biệt: Phố đêm' },
        style: 'cyberpunk, neon, cinematic',
        camera: 'fast prime lens (f/1.4), handheld, capturing motion',
        lighting: 'neon signs, streetlights, creating a colorful, moody scene',
        mood: 'futuristic, mysterious, alive',
        aspect: '16:9',
        beauty: 'off',
    },
    'special-wedding': {
        label: { en: 'Special: Wedding', vi: 'Đặc biệt: Đám cưới' },
        style: 'romantic, dreamy, emotional',
        camera: '85mm f/1.4 for portraits, 35mm for moments, soft focus',
        lighting: 'natural light, golden hour, fairy lights',
        mood: 'loving, happy, timeless',
        aspect: '3:2',
        beauty: 'on',
    },
    'special-newborn': {
        label: { en: 'Special: Newborn', vi: 'Đặc biệt: Trẻ sơ sinh' },
        style: 'tender, pure, delicate',
        camera: '50mm macro, close-up on details, very shallow DoF',
        lighting: 'large, soft window light, warm and gentle',
        mood: 'innocent, peaceful, loving',
        aspect: '4:5',
        beauty: 'off',
    },
    'special-sports': {
        label: { en: 'Special: Sports', vi: 'Đặc biệt: Thể thao' },
        style: 'dynamic, powerful, action-packed',
        camera: 'telephoto lens (300mm+), fast shutter speed, panning',
        lighting: 'stadium lights or harsh daylight, creating drama',
        mood: 'energetic, competitive, triumphant',
        aspect: '16:9',
        beauty: 'off',
    },
    'special-wildlife': {
        label: { en: 'Special: Wildlife', vi: 'Đặc biệt: Động vật hoang dã' },
        style: 'natural, majestic, candid',
        camera: 'long telephoto lens (600mm+), eye-level with the animal',
        lighting: 'early morning or late afternoon light',
        mood: 'wild, free, respectful',
        aspect: '3:2',
        beauty: 'off',
    },
    'special-aerial': {
        label: { en: 'Special: Aerial', vi: 'Đặc biệt: Trên không' },
        style: 'epic, abstract, birds-eye view',
        camera: 'drone camera, wide-angle, top-down perspective',
        lighting: 'midday sun for patterns or golden hour for long shadows',
        mood: 'grand, expansive, unique',
        aspect: '16:9',
        beauty: 'off',
    },
    'special-conceptual': {
        label: { en: 'Special: Conceptual', vi: 'Đặc biệt: Ý niệm' },
        style: 'surreal, thought-provoking, artistic',
        camera: 'any lens, focus on the idea, not realism',
        lighting: 'lighting to serve the concept, can be unnatural or symbolic',
        mood: 'mysterious, intellectual, imaginative',
        aspect: '4:5',
        beauty: 'off',
    },
    'special-vintage-film': {
        label: { en: 'Special: Vintage Film', vi: 'Đặc biệt: Phim Cổ điển' },
        style: 'nostalgic, grainy, faded colors, analog film emulation (like Kodachrome or Portra 400)',
        camera: '50mm prime lens, classic composition, slight vignetting',
        lighting: 'natural, slightly underexposed, warm golden hour tones',
        mood: 'sentimental, timeless, authentic, cinematic',
        aspect: '3:2',
        beauty: 'off',
    },
    'art-fantasy': {
        label: { en: 'Art: Fantasy', vi: 'Nghệ thuật: Giả tưởng' },
        style: 'magical, epic, illustrative',
        camera: 'cinematic angles, wide shots for environments, portraits for characters',
        lighting: 'glowing magical light, dramatic god rays, ethereal glow',
        mood: 'adventurous, mystical, enchanting',
        aspect: '16:9',
        beauty: 'on',
    },
    'art-sci-fi': {
        label: { en: 'Art: Sci-Fi', vi: 'Nghệ thuật: Khoa học viễn tưởng' },
        style: 'futuristic, technological, sleek',
        camera: 'anamorphic lens look, clean lines, vast cityscapes or tight ship interiors',
        lighting: 'holographic projections, neon highlights, cold metallic reflections',
        mood: 'awe-inspiring, advanced, dystopian or utopian',
        aspect: '21:9',
        beauty: 'off',
    },
    'art-cyberpunk-city': {
        label: { en: 'Art: Cyberpunk Cityscape', vi: 'Nghệ thuật: Thành phố Cyberpunk' },
        style: 'futuristic, neon-drenched, dystopian, high-tech',
        camera: 'wide-angle lens, low angle, dynamic composition, cinematic',
        lighting: 'glowing neon signs, reflections on wet pavement, volumetric fog',
        mood: 'gritty, mysterious, vibrant, alive',
        aspect: '21:9',
        beauty: 'off',
    },
    'art-watercolor-portrait': {
        label: { en: 'Art: Watercolor Portrait', vi: 'Nghệ thuật: Chân dung Màu nước' },
        style: 'soft, translucent, blended colors, expressive brushstrokes',
        camera: 'n/a (artistic interpretation), focus on emotion',
        lighting: 'diffused, high-key lighting, soft shadows, mimicking natural light on paper',
        mood: 'dreamy, delicate, artistic, gentle',
        aspect: '3:4',
        beauty: 'on',
    },
    'special-abstract-geometric': {
        label: { en: 'Art: Abstract Geometric', vi: 'Nghệ thuật: Trừu tượng Hình học' },
        style: 'minimalist, clean lines, bold shapes, bauhaus inspired, non-representational',
        camera: 'n/a (graphic design), precision and balance',
        lighting: 'flat, even lighting to emphasize form and color',
        mood: 'modern, intellectual, orderly, sophisticated',
        aspect: '1:1',
        beauty: 'off',
    },
};

const TRENDS: Record<string, { label: {[key in Language]: string}; prompt: string; }> = {
    'action-figure': {
        label: { en: 'Action Figure', vi: 'Mô hình Figure' },
        prompt: 'Recreate the subject as a collectible action figure inside its original packaging. The packaging should be branded with a cool logo and design. The figure should look like it\'s made of plastic, with visible joints. The style is hyper-realistic, mimicking a photograph of a real toy product on a store shelf.'
    },
    'giant-monument': {
        label: { en: 'Giant Monument', vi: 'Tượng đài khổng lồ' },
        prompt: 'Transform the subject into a giant, majestic monument made of weathered stone or bronze. Place the monument in an epic location like a mountain top or a historic city square. The lighting should be dramatic, like at sunrise or sunset, to create long shadows and a powerful mood. The style is epic and photorealistic.'
    },
    'giant-person': {
        label: { en: 'Giant Person', vi: 'Người khổng lồ' },
        prompt: 'Imagine the subject as a friendly giant walking through a tiny, miniature-scale city or landscape. The perspective should be from a low angle to emphasize their immense size. The overall mood is whimsical, awe-inspiring, and gentle, as if the giant is carefully exploring the small world below.'
    },
    'billboard-ad': {
        label: { en: 'Billboard Ad', vi: 'Pano quảng cáo' },
        prompt: 'Feature the subject on a massive, glowing billboard advertisement in a bustling, futuristic city at night, similar to Times Square or Neo-Tokyo. The city should be filled with neon lights, flying vehicles, and dense architecture. The ad on the billboard should look sleek and professional, as if for a major brand.'
    },
    'magazine-cover': {
        label: { en: 'Magazine Cover', vi: 'Bìa tạp chí' },
        prompt: 'Create a high-fashion magazine cover featuring the subject as the star. The cover should have a bold magazine title (e.g., "VOGUE", "GQ", "STYLE"), eye-catching headlines, and a barcode. The subject\'s photo should be styled professionally with studio lighting and a powerful pose. The mood is chic, modern, and glamorous.'
    },
    'tv-show': {
        label: { en: 'TV Show', vi: 'Show truyền hình' },
        prompt: 'Place the subject as a celebrity guest on a late-night talk show set. The scene should show them being interviewed, with studio lights, multiple cameras, a host\'s desk, and a blurred audience in the background. The subject could also be displayed on the large screens on the set. The mood is lively, professional, and exciting.'
    },
    'advertising-sign': {
        label: { en: 'Advertising Sign', vi: 'Biển quảng cáo' },
        prompt: 'Integrate the subject into a glowing, modern advertising light box on a city street or inside a subway station. The sign should be sleek and minimalist. The environment should be clean and contemporary, with reflections on wet pavement or polished floors. The mood is sophisticated and urban.'
    },
    'cyborg': {
        label: { en: 'Cyborg', vi: 'Người máy' },
        prompt: 'Transform the subject into a futuristic cyborg. Seamlessly blend their human features with intricate robotic parts, glowing wires, and metallic textures. The style should be inspired by cyberpunk art, with dramatic lighting, a dark and moody atmosphere, and a high level of detail in the mechanical components.'
    },
    'wedding-photo': {
        label: { en: 'Wedding Photo', vi: 'Ảnh cưới' },
        prompt: 'Recreate the subjects in a beautiful, romantic wedding photo. They should be dressed in elegant wedding attire (a stunning white gown for the bride, a sharp suit for the groom). The setting should be a picturesque location, like a beach at sunset, a lush garden, or a classic chapel. The mood is romantic, elegant, and timeless. The style should be professional wedding photography.'
    },
    'travel-adventure': {
        label: { en: 'Travel Adventure', vi: 'Du lịch Khám phá' },
        prompt: 'Place the subjects on an epic travel adventure. They could be standing on a mountain peak with a breathtaking view, exploring an ancient ruin, or relaxing on a tropical beach. The image should look like a stunning travel influencer photo, with vibrant colors, beautiful lighting, and a sense of wonder and exploration. The mood is adventurous, happy, and awe-inspiring.'
    }
};

const VIETNAMESE_TEXT_INSTRUCTION = `
[VIETNAMESE TEXT RENDERING INSTRUCTION]
If the prompt requires rendering Vietnamese text within the image, you MUST adhere to the following rules to ensure correctness:
1.  **Use correct Unicode:** Render all Vietnamese text using precomposed Unicode characters (NFC). For example, render "ấ" directly, not as "a" + "^" + "´".
2.  **Correct Diacritics:** Ensure all diacritics (sắc, huyền, hỏi, ngã, nặng) are correctly placed on the main vowel of a syllable.
3.  **Accurate Spelling:** Use correct modern Vietnamese spelling. Pay close attention to common words like "đẹp", "tuyệt vời", "cảm ơn".
4.  **No Character Corruption:** Avoid rendering corrupted or incorrect characters from legacy encodings (like VNI or TCVN3). The final text must be clean, modern, and perfectly legible Vietnamese.
The final output must display Vietnamese text with perfect, accurate diacritics.
`;


const buildPresetDirective = (presetId: string, overrides?: { beauty?: 'on' | 'off', aspect?: string }) => {
    const p = PRESETS[presetId];
    if (!p) return '';
    const aspect = overrides?.aspect && overrides.aspect !== 'auto' ? overrides.aspect : (p.aspect ?? PRESET_CONTROLLER.global_defaults.aspect_fallback);
    const beauty = overrides?.beauty ?? p.beauty;

    const quality = `[QUALITY] ${PRESET_CONTROLLER.quality_block}`;
    const global = `[GLOBAL] aspect=${aspect}; pipeline=${PRESET_CONTROLLER.global_defaults.color_pipeline}; noise_floor=${PRESET_CONTROLLER.global_defaults.noise_floor}.`;
    const preset = `[PRESET:${presetId}] style=${p.style}; camera=${p.camera}; lighting=${p.lighting}; mood=${p.mood}; beauty=${beauty}.`;
    const instruction = `[INSTRUCTION] ${PRESET_CONTROLLER.generation_instruction}`;
    
    return `${quality}\n\n${global}\n${preset}\n${instruction}`;
}

const getDownloadFilename = (dataUrl: string | null): string => {
    if (!dataUrl) return "generated-image.png";
    try {
        const mimeType = dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
        let extension = mimeType.split('/')[1];
        if (extension === 'jpeg') {
            extension = 'jpg';
        }
        return `generated-image.${extension}`;
    } catch (e) {
        return "generated-image.png";
    }
};


const CONTROL_MODES: ControlMode[] = ['Pose', 'Edge', 'Depth', 'Creative'];

const ASPECT_RATIOS = [
  { value: 'auto', label: { en: 'Auto (from model image)', vi: 'Tự động (theo ảnh gốc)' } },
  { value: '1:1', label: { en: '1:1 (Square)', vi: '1:1 (Vuông)' } },
  { value: '3:4', label: { en: '3:4 (Portrait)', vi: '3:4 (Dọc)' } },
  { value: '4:3', label: { en: '4:3 (Landscape)', vi: '4:3 (Ngang)' } },
  { value: '4:5', label: { en: '4:5 (Portrait)', vi: '4:5 (Dọc)' } },
  { value: '2:3', label: { en: '2:3 (Portrait)', vi: '2:3 (Dọc)' } },
  { value: '3:2', label: { en: '3:2 (Landscape)', vi: '3:2 (Ngang)' } },
  { value: '16:9', label: { en: '16:9 (Widescreen)', vi: '16:9 (Màn ảnh rộng)' } },
  { value: '9:16', label: { en: '9:16 (Tall)', vi: '9:16 (Cao)' } },
  { value: '21:9', label: { en: '21:9 (Cinematic)', vi: '21:9 (Điện ảnh)' } },
];

const TRANSLATIONS = {
  en: {
    // General
    appName: APP_NAME,
    generate: 'Generate',
    generating: 'Generating...',
    goBack: 'Go Back',
    download: 'Download',
    // Header
    toggleTheme: 'Toggle Theme',
    language: 'Language',
    // Home Page
    homeTitle: 'Unleash Your Creativity',
    homeSubtitle: 'Choose a tool to begin your AI-powered artistic journey.',
    poseStudioTitle: 'Pose Studio',
    poseStudioDesc: 'Animate your character with any pose from a sketch.',
    propFusionTitle: 'Prop Fusion',
    propFusionDesc: 'Seamlessly integrate any prop into your image.',
    designStudioTitle: 'AI Design',
    designStudioDesc: 'Blend subject with background & artistic styles.',
    creativeStudioTitle: 'AI Creative',
    creativeStudioDesc: 'Turn your text descriptions into stunning images.',
    stylistStudioTitle: 'AI Stylist',
    stylistStudioDesc: 'Try any outfit on a model instantly.',
    architectStudioTitle: 'AI Architect',
    architectStudioDesc: 'Turn 2D sketches into realistic 3D architectural renders.',
    videoStudioTitle: 'AI Video Create',
    videoStudioDesc: 'Create stunning videos from text or images.',
    magicStudioTitle: 'AI Magic',
    magicStudioDesc: 'Beautify & restore old photos with one click.',
    upscaleStudioTitle: 'Upscale AI',
    upscaleStudioDesc: 'Upgrade images to a higher resolution, adding realistic details and textures.',
    backgroundStudioTitle: 'AI Background Remover',
    backgroundStudioDesc: 'Remove the background from any image with one click.',
    trendkoTitle: 'AI Trend Maker',
    trendkoDesc: 'Create viral-style images with a single click.',
    batchStudioTitle: 'Whisk Auto Studio',
    batchStudioDesc: 'Batch generate images from a set of assets and prompts.',
    lookbookStudioTitle: 'Lookbook Studio',
    lookbookStudioDesc: 'Create professional lookbook pages from your photos.',
    productPlacementTitle: 'AI Product Placement',
    productPlacementDesc: 'Place your product into any scene realistically.',
    comicStudioTitle: 'AI Comic Style',
    comicStudioDesc: 'Transform your photos into various comic book styles.',
    // Tool Page
    uploadCharacter: 'Upload Character',
    uploadPose: 'Upload Pose Sketch',
    uploadProp: 'Upload Prop',
    uploadSubject: 'Upload Subject',
    uploadSecondSubject: 'Upload Second Subject (Optional)',
    uploadBackground: 'Upload Background',
    uploadModel: 'Upload Model',
    uploadOutfit: 'Upload Outfit',
    uploadBlueprint: 'Upload Blueprint / Sketch',
    uploadImage: 'Upload Image',
    uploadSourceImage: 'Upload Source Image',
    uploadContext: 'Upload Context / Background',
    uploadMultipleImages: 'Upload Images (2+ recommended)',
    uploadScene: 'Upload Scene',
    uploadProduct: 'Upload Product',
    imagePrompt: 'Image Prompt',
    imagePromptPlaceholder: 'Describe the image you want to create in detail...',
    videoPrompt: 'Video Prompt',
    videoPromptPlaceholder: 'Describe the video you want to create...',
    positivePrompt: 'Positive Prompt',
    positivePromptPlaceholder: 'Describe details you want to add...',
    positivePromptExample: 'e.g., high quality, sharp details, natural lighting...',
    negativePrompt: 'Negative Prompt',
    negativePromptPlaceholder: 'Describe what you want to avoid...',
    negativePromptExample: 'e.g., blurry, deformed, unnatural hands, low quality...',
    sourceImage: 'Source Image',
    nameTitle: 'Name / Title',
    nameTitlePlaceholder: 'E.g., Your name, your character\'s name',
    hintDescription: 'Hint / Description',
    hintDescriptionPlaceholder: 'E.g., Your profession, hobby, passion, a place...',
    chooseTrends: 'Choose Trends',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    generateTrends: 'Generate Trends',
    generatingTrends: 'Generating Trends...',
    noTrendsSelected: 'Please select at least one trend to generate.',
    // Lookbook
    generateLookbook: 'Generate Lookbook',
    generatingLookbook: 'Generating Lookbook...',
    pageOrientation: 'Page Orientation',
    numberOfPages: 'Number of Pages',
    lookbookWedding: 'Wedding',
    lookbookYearbook: 'Yearbook',
    lookbookTravel: 'Travel',
    lookbookTimeline: 'Timeline',
    lookbookContent: 'Page Content (one line per page)',
    lookbookContentPlaceholder: 'E.g., Title 1 // Body content for page 1...\nTitle 2 // Body content for page 2...',
    errorNotEnoughImages: 'Please upload at least 2 images to create a lookbook.',
    // Default Prompts
    stylistPositiveDefault: 'hyper-realistic, detailed, 8k, professional photography',
    stylistNegativeDefault: 'blurry, distorted, malformed, deformed, different person, ugly',
    stylistCharacter: 'Main Character Image',
    stylistAccessories: 'Outfit & Accessories (optional)',
    stylistSceneDescription: 'Scene Description (optional)',
    stylistSceneDescriptionPlaceholder: 'e.g., standing on a street in Paris...',
    autoPreset: 'Auto (from model image)',
    propFusionPositiveDefault: 'hyper-realistic, detailed, 8k, seamless integration',
    propFusionNegativeDefault: 'blurry, distorted, floating, discolored, malformed, deformed',
    designPositiveDefault: 'masterpiece, 8k, high quality, trending on artstation',
    designNegativeDefault: 'blurry, bad art, poorly drawn, deformed',
    creativeNegativeDefault: 'ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, blurry, bad anatomy, blurred, watermark, grainy, signature, cut off, draft',
    architectPositiveDefault: 'photorealistic render, octane render, unreal engine 5, 8k, detailed materials, cinematic lighting',
    architectNegativeDefault: 'cartoon, sketch, drawing, watermark, signature, ugly',
    productPlacementPositiveDefault: 'hyper-realistic, detailed, 8k, seamless integration, perfect lighting and shadows',
    productPlacementNegativeDefault: 'blurry, distorted, floating, discolored, malformed, deformed, unrealistic, cartoonish',
    dragOrClick: 'Drag & drop or click to upload',
    preview: 'Preview',
    result: 'Result',
    preset: 'Preset',
    controlMode: 'Control Mode',
    aspectRatio: 'Aspect Ratio',
    outputFormat: 'Output Format',
    beautify: 'Beautify',
    beautifyHint: '(Only applies to portrait presets)',
    error: 'An error occurred. Please try again.',
    serviceUnavailable: 'Service is currently unavailable. Please try again later.',
    // Control Modes
    controlModePose: 'Pose',
    controlModeEdge: 'Edge',
    controlModeDepth: 'Depth',
    controlModeCreative: 'Creative',
    controlModeDesc_Pose: 'Precisely copies the human pose from the reference sketch. Best for character control.',
    controlModeDesc_Edge: 'Uses outlines (edges) from the reference to guide generation. Ideal for line art and sketch-based styles.',
    controlModeDesc_Depth: 'Maintains the 3D structure and depth of the scene from the reference. Good for environmental consistency.',
    controlModeDesc_Creative: 'Gives the AI more freedom to creatively reinterpret the inputs based on the prompt.',
    // Tabs
    features: 'Features',
    guide: 'Guide',
    tips: 'Tips',
    // Tool Info Content
    poseFeatures: ['Animate your character with any pose from a sketch.', 'Utilize a wide range of professional presets.', 'Preset Controller v3 for 8K cinematic output.'],
    poseGuide: ['1. Upload your character image.', '2. Upload a clear pose sketch.', '3. Select a style preset and control mode.', '4. (Optional) Refine with prompts.', '5. Click "Generate"!'],
    poseTips: ['Use sketches with clear, single-color lines for best results.', 'Transparent background (PNG) for the character is recommended.', 'The "Edge" control mode is great for comic styles.'],
    propFeatures: ['Seamlessly integrate any prop into your image.', 'AI matches lighting, perspective, and shadows.', 'Perfect for adding accessories, objects, or effects.'],
    propGuide: ['1. Upload the main scene/character image.', '2. Upload the prop image.', '3. Select a preset that matches the scene.', '4. (Optional) Guide the integration with prompts.', '5. Click "Generate"!'],
    propTips: ["Use prop images with a clean or transparent background.", "For best results, ensure the prop's perspective is similar to the main image.", "Describe how the prop should interact with the scene in the positive prompt."],
    designFeatures: ['Blend subject with artistic backgrounds.', 'Apply numerous artistic styles.', 'Preset Controller v3 for 8K cinematic output.'],
    designGuide: ['1. Upload a clear subject image.', '2. Upload the desired background image.', '3. Select a preset to define the style.', '4. (Optional) Write additional prompts for refinement.', '5. Click "Generate" and wait for the result!'],
    designTips: ['Use subject images with transparent backgrounds (PNG) for best results.', '"Art" and "Fantasy" presets create impressive effects.', 'Experiment with different positive and negative prompts.'],
    creativeFeatures: ['Turn your text descriptions into stunning images.', 'Leverages powerful presets for specific styles.', 'Full control over aspect ratio and fine details.'],
    creativeGuide: ['1. Write a detailed description of your desired image.', '2. Select a preset that matches your vision (e.g., Sci-Fi, Portrait).', '3. Choose your desired aspect ratio.', '4. Use negative prompts to exclude unwanted elements.', '5. Click "Generate"!'],
    creativeTips: ['Be specific! Instead of "a car", try "a red 1960s convertible sports car".', 'Use commas to combine different concepts.', 'The "Beautify" option works great for creating characters.'],
    stylistFeatures: ['Instantly try any outfit on a model.', 'Realistic fabric textures and draping.', "Maintains the model's identity and pose."],
    stylistGuide: ['1. Upload a full-body photo of the model.', '2. Upload a clear image of the clothing item.', '3. Choose a fashion-related preset.', '4. (Optional) Specify fabric type in the prompt.', '5. Click "Generate"!'],
    stylistTips: ['Use clear, front-facing photos of both the model and the outfit.', 'Simple backgrounds work best for both images.', 'Ensure the outfit image shows the entire garment.'],
    architectFeatures: ['Transform 2D sketches into realistic 3D renders.', 'Supports interior and exterior designs.', 'Cinematic lighting and high-quality materials.'],
    architectGuide: ['1. Upload a blueprint or architectural sketch.', '2. Choose an appropriate preset (e.g., Exterior, Interior).', '3. Use prompts to specify materials, time of day, and mood.', '4. (Optional) Use negative prompts to avoid cartoony looks.', '5. Click "Generate"!'],
    architectTips: ['High-contrast, clean line drawings work best.', 'Specify materials like "oak wood floor", "concrete walls".', 'For lighting, try prompts like "golden hour lighting" or "soft morning light".'],
    magicFeatures: ['One-click photo enhancement.', 'Combine multiple effects like beautify and restore.', "Advanced AI ensures the subject's identity is perfectly preserved."],
    magicGuide: ['1. Upload the image you want to edit.', '2. Toggle the features you want to apply (e.g., Beautify, Restore).', '3. Ensure "Preserve Identity" is on for portraits.', '4. Click "Generate" to see the magic!'],
    magicTips: ['Works best with one primary subject.', 'The "Restore" feature is powerful for scanned family photos.', 'Combine features for a complete photo makeover.'],
    upscaleFeatures: ['Dramatically increase image resolution (4x or more).', 'Generates new, photorealistic details and textures.', 'Perfect for preparing images for print or high-res displays.'],
    upscaleGuide: ['1. Upload the image you want to upscale.', '2. (Optional) Adjust aspect ratio or output format.', '3. Click "Generate" to start the process.'],
    upscaleTips: ['Start with the highest quality source image you have for best results.', 'The process can take longer than other edits due to intensive detail generation.', 'The resulting file size will be significantly larger.'],
    backgroundFeatures: ['One-click background removal.', 'Outputs high-resolution PNG with transparency.', 'Perfect for product photos, portraits, and more.'],
    backgroundGuide: ['1. Upload the image you want to edit.', '2. Click "Generate"!', '3. Download your image with a transparent background.'],
    backgroundTips: ['Use images with a clear subject for the best results.', 'The output is a PNG, perfect for placing on new backgrounds.', 'High-resolution input images will produce high-resolution outputs.'],
    placementFeatures: ['Place any product into any scene with stunning realism.', 'AI automatically adjusts for perspective, lighting, and shadows.', 'Ideal for creating professional product mockups and ads.'],
    placementGuide: ['1. Upload your background scene image.', '2. Upload your product image (transparent BG is best).', '3. Select a "Product" or "Commercial" preset.', '4. Use prompts to guide placement, e.g., "place the bottle on the wooden table".', '5. Click "Generate"!'],
    placementTips: ['Use high-quality scene and product images.', 'A product with a transparent background (PNG) gives the best results.', 'Be specific in your positive prompt about where and how the product should be placed.'],
    // Video Tool
    generateVideo: 'Generate Video',
    generatingVideo: 'Generating Video...',
    videoResult: 'Video Result',
    generationMode: 'Generation Mode',
    textToVideo: 'Text to Video',
    imageToVideo: 'Image to Video',
    videoWillAppear: 'Your generated video will appear here.',
    videoInProgress: 'Video generation in progress...',
    videoInProgressCompose: 'Step 1: Composing scene...||Step 2: Generating video...',
    videoTakesTime: 'This may take several minutes.',
    videoAspectRatio: 'Aspect Ratio',
    videoQuality: 'Quality',
    portrait: 'Portrait',
    landscape: 'Landscape',
    hd720: '720p (HD)',
    hd1080: '1080p (Full HD)',
    videoPromptRequired: 'Please enter a video prompt.',
    videoImageRequired: 'Please upload an image for Image-to-Video mode.',
    videoImageRequiredBoth: 'Please upload both a Character and a Context image.',
    videoAspectSquare: '1:1 (Square)',
    // Magic Tool
    magicBeautify: 'Beautify Skin',
    magicBeautifyDesc: 'Smooth skin, remove acne and blemishes.',
    magicRestore: 'Restore Old Photo',
    magicRestoreDesc: 'Fix blur, scratches, and color fading.',
    preserveIdentity: 'Preserve Identity',
    preserveIdentityDesc: "Strictly maintain the person's original facial features.",
    errorNoMagicFeature: 'Please select at least one magic feature or enter a prompt.',
    // Upscale Tool
    upscaleLevelLabel: 'Upscale Level',
    upscaleSkinStyleLabel: 'Skin Rendering Style',
    skinStyle_Beauty_Smooth: 'Beauty Smooth (Flawless Commercial)',
    skinStyle_High_Fidelity_Realism: 'High-Fidelity (Cinematic Natural)',
    skinStyle_Hybrid_Luxury: 'Hybrid Luxury (Glossy & Natural)',
    // Batch Tool
    batchProject: 'Project Assets',
    batchUploadAssets: 'Upload Project Assets',
    batchPrompts: 'Enter Prompts (one per line)',
    batchPromptsPlaceholder: 'A man and a woman looking at an ancient temple...\nA man hugging a woman from behind...',
    batchStart: 'Start Generation',
    batchStop: 'Stop Generation',
    batchGenerating: 'Generating Batch...',
    batchStopped: 'Stopped',
    batchCompleted: 'Completed',
    batchResults: 'Batch Generation Results',
    batchNoAssets: 'Please upload at least one character and one background asset.',
    batchNoPrompts: 'Please enter at least one prompt.',
    batchCharacter: 'Character',
    batchBackground: 'Background',
    batchStyle: 'Style',
  },
  vi: {
    // General
    appName: APP_NAME,
    generate: 'Tạo ảnh',
    generating: 'Đang tạo...',
    goBack: 'Quay lại',
    download: 'Tải xuống',
    // Header
    toggleTheme: 'Chuyển đổi Giao diện',
    language: 'Ngôn ngữ',
    // Home Page
    homeTitle: 'Giải phóng Sáng tạo',
    homeSubtitle: 'Chọn một công cụ để bắt đầu hành trình nghệ thuật với AI.',
    poseStudioTitle: 'Xưởng Tư thế',
    poseStudioDesc: 'Tạo dáng nhân vật của bạn theo bất kỳ tư thế nào từ phác thảo.',
    propFusionTitle: 'Hòa trộn Đạo cụ',
    propFusionDesc: 'Tích hợp liền mạch bất kỳ đạo cụ nào vào hình ảnh của bạn.',
    designStudioTitle: 'Thiết kế AI',
    designStudioDesc: 'Hòa trộn chủ thể với nền & phong cách nghệ thuật.',
    creativeStudioTitle: 'Sáng tạo AI',
    creativeStudioDesc: 'Biến mô tả văn bản của bạn thành hình ảnh tuyệt đẹp.',
    stylistStudioTitle: 'Thời trang AI',
    stylistStudioDesc: 'Thử bất kỳ trang phục nào trên người mẫu ngay lập tức.',
    architectStudioTitle: 'Kiến trúc AI',
    architectStudioDesc: 'Biến bản phác thảo 2D thành ảnh render kiến trúc 3D thực tế.',
    videoStudioTitle: 'Tạo Video AI',
    videoStudioDesc: 'Tạo video tuyệt đẹp từ văn bản hoặc hình ảnh.',
    magicStudioTitle: 'AI Ma Thuật',
    magicStudioDesc: 'Làm đẹp & phục chế ảnh cũ chỉ bằng một cú nhấp chuột.',
    upscaleStudioTitle: 'AI Nâng Cấp',
    upscaleStudioDesc: 'Nâng cấp hình ảnh lên độ phân giải cao hơn, thêm các chi tiết và kết cấu chân thực.',
    backgroundStudioTitle: 'Xóa Nền AI',
    backgroundStudioDesc: 'Xóa nền khỏi bất kỳ hình ảnh nào chỉ bằng một cú nhấp chuột.',
    trendkoTitle: 'AI Trend Maker',
    trendkoDesc: 'Tạo ảnh theo phong cách viral chỉ bằng một cú nhấp chuột.',
    batchStudioTitle: 'Whisk Auto Studio',
    batchStudioDesc: 'Tạo ảnh hàng loạt từ một bộ tài sản và prompts.',
    lookbookStudioTitle: 'Xưởng Lookbook',
    lookbookStudioDesc: 'Tạo các trang lookbook chuyên nghiệp từ ảnh của bạn.',
    productPlacementTitle: 'Thương mại AI',
    productPlacementDesc: 'Đặt sản phẩm của bạn vào bất kỳ bối cảnh nào một cách chân thực.',
    comicStudioTitle: 'AI Phong cách Comic',
    comicStudioDesc: 'Biến ảnh của bạn thành nhiều phong cách truyện tranh khác nhau.',
    // Tool Page
    uploadCharacter: 'Tải lên Nhân vật',
    uploadPose: 'Tải lên Phác thảo Tư thế',
    uploadProp: 'Tải lên Đạo cụ',
    uploadSubject: 'Tải lên Chủ thể',
    uploadSecondSubject: 'Tải lên Chủ thể thứ hai (Tùy chọn)',
    uploadBackground: 'Tải lên Nền',
    uploadModel: 'Tải lên Người mẫu',
    uploadOutfit: 'Tải lên Trang phục',
    uploadBlueprint: 'Tải lên Bản thiết kế / Phác thảo',
    uploadImage: 'Tải lên Hình ảnh',
    uploadSourceImage: 'Tải lên Ảnh Gốc',
    uploadContext: 'Tải lên Bối cảnh / Nền',
    uploadMultipleImages: 'Tải lên nhiều ảnh (khuyên dùng 2+)',
    uploadScene: 'Tải lên Bối cảnh',
    uploadProduct: 'Tải lên Sản phẩm',
    imagePrompt: 'Prompt Ảnh',
    imagePromptPlaceholder: 'Mô tả chi tiết hình ảnh bạn muốn tạo...',
    videoPrompt: 'Mô tả Video',
    videoPromptPlaceholder: 'Mô tả video bạn muốn tạo...',
    positivePrompt: 'Prompt Tích cực',
    positivePromptPlaceholder: 'Mô tả các chi tiết bạn muốn thêm...',
    positivePromptExample: 'VD: chất lượng cao, chi tiết sắc nét, ánh sáng tự nhiên...',
    negativePrompt: 'Prompt Tiêu cực',
    negativePromptPlaceholder: 'Mô tả những gì bạn muốn tránh...',
    negativePromptExample: 'VD: mờ, biến dạng, tay không tự nhiên, chất lượng thấp...',
    sourceImage: 'Ảnh Gốc',
    nameTitle: 'Tên / Tiêu đề',
    nameTitlePlaceholder: 'Ví dụ: Tên của bạn, tên mô hình của bạn',
    hintDescription: 'Gợi ý / Mô tả',
    hintDescriptionPlaceholder: 'Nghề nghiệp, sở thích, đam mê, địa điểm bạn muốn...',
    chooseTrends: 'Chọn Trends',
    selectAll: 'Chọn tất cả',
    deselectAll: 'Bỏ chọn tất cả',
    generateTrends: 'Tạo ảnh Trends',
    generatingTrends: 'Đang tạo Trends...',
    noTrendsSelected: 'Vui lòng chọn ít nhất một trend để tạo ảnh.',
    // Lookbook
    generateLookbook: 'Tạo Lookbook',
    generatingLookbook: 'Đang tạo Lookbook...',
    pageOrientation: 'Bố cục Trang',
    numberOfPages: 'Số trang',
    lookbookWedding: 'Ảnh cưới',
    lookbookYearbook: 'Kỷ yếu',
    lookbookTravel: 'Du lịch',
    lookbookTimeline: 'Timeline',
    lookbookContent: 'Nội dung Trang (mỗi dòng một trang)',
    lookbookContentPlaceholder: 'VD: Tiêu đề 1 // Nội dung cho trang 1...\nTiêu đề 2 // Nội dung cho trang 2...',
    errorNotEnoughImages: 'Vui lòng tải lên ít nhất 2 ảnh để tạo lookbook.',
    // Default Prompts
    stylistPositiveDefault: 'siêu thực, chi tiết, 8k, nhiếp ảnh chuyên nghiệp',
    stylistNegativeDefault: 'mờ, méo mó, dị dạng, biến dạng, người khác, xấu xí',
    stylistCharacter: 'Ảnh Nhân Vật Chính',
    stylistAccessories: 'Ảnh Trang Phục & Phụ Kiện (tùy chọn)',
    stylistSceneDescription: 'Mô tả bối cảnh (tùy chọn)',
    stylistSceneDescriptionPlaceholder: 'VD: đang đứng ở đường phố Paris...',
    autoPreset: 'Tự động (theo ảnh mẫu)',
    propFusionPositiveDefault: 'siêu thực, chi tiết, 8k, tích hợp liền mạch',
    propFusionNegativeDefault: 'mờ, méo mó, lơ lửng, bạc màu, dị dạng, biến dạng',
    designPositiveDefault: 'kiệt tác, 8k, chất lượng cao, thịnh hành trên artstation',
    designNegativeDefault: 'mờ, nghệ thuật kém, vẽ xấu, biến dạng',
    creativeNegativeDefault: 'xấu, lặp lại, tay vẽ xấu, chân vẽ xấu, mặt vẽ xấu, ngoài khung hình, thừa chi, dị dạng, biến dạng, cơ thể ngoài khung hình, mờ, giải phẫu sai, nhoè, watermark, nhiễu hạt, chữ ký, cắt cảnh, bản nháp',
    architectPositiveDefault: 'render ảnh thực, render octane, unreal engine 5, 8k, vật liệu chi tiết, ánh sáng điện ảnh',
    architectNegativeDefault: 'hoạt hình, phác thảo, bản vẽ, watermark, chữ ký, xấu',
    productPlacementPositiveDefault: 'siêu thực, chi tiết, 8k, tích hợp liền mạch, ánh sáng và bóng đổ hoàn hảo',
    productPlacementNegativeDefault: 'mờ, méo mó, lơ lửng, bạc màu, dị dạng, biến dạng, không thực tế, hoạt hình',
    dragOrClick: 'Kéo & thả hoặc nhấp để tải lên',
    preview: 'Xem trước',
    result: 'Kết quả',
    preset: 'Preset',
    controlMode: 'Chế độ Kiểm soát',
    aspectRatio: 'Tỷ lệ Khung hình',
    outputFormat: 'Định dạng Đầu ra',
    beautify: 'Làm đẹp da',
    beautifyHint: '(Chỉ áp dụng cho preset chân dung)',
    error: 'Đã xảy ra lỗi. Vui lòng thử lại.',
    serviceUnavailable: 'Dịch vụ hiện không có sẵn. Vui lòng thử lại sau.',
    // Control Modes
    controlModePose: 'Tư thế',
    controlModeEdge: 'Đường viền',
    controlModeDepth: 'Chiều sâu',
    controlModeCreative: 'Sáng tạo',
    controlModeDesc_Pose: 'Sao chép chính xác tư thế người từ bản phác thảo. Tốt nhất để kiểm soát tạo dáng nhân vật.',
    controlModeDesc_Edge: 'Sử dụng các đường viền (edges) từ ảnh tham chiếu để hướng dẫn tạo ảnh. Lý tưởng cho phong cách line art và phác thảo.',
    controlModeDesc_Depth: 'Duy trì cấu trúc 3D và chiều sâu của cảnh từ ảnh tham chiếu. Tốt cho sự nhất quán của môi trường.',
    controlModeDesc_Creative: 'Cho AI tự do hơn để diễn giải lại các hình ảnh đầu vào một cách sáng tạo dựa trên prompt.',
    // Tabs
    features: 'Tính năng',
    guide: 'Hướng dẫn',
    tips: 'Mẹo',
    // Tool Info Content
    poseFeatures: ['Tạo dáng nhân vật theo bất kỳ tư thế nào từ phác thảo.', 'Sử dụng nhiều preset chuyên nghiệp.', 'Preset Controller v3 cho đầu ra 8K điện ảnh.'],
    poseGuide: ['1. Tải lên ảnh nhân vật của bạn.', '2. Tải lên bản phác thảo tư thế rõ nét.', '3. Chọn preset phong cách và chế độ kiểm soát.', '4. (Tùy chọn) Tinh chỉnh bằng prompt.', '5. Nhấn "Tạo ảnh"!'],
    poseTips: ['Sử dụng phác thảo với đường nét rõ ràng, đơn sắc để có kết quả tốt nhất.', 'Nên dùng ảnh nhân vật có nền trong suốt (PNG).', 'Chế độ kiểm soát "Edge" rất phù hợp cho phong cách truyện tranh.'],
    propFeatures: ['Tích hợp liền mạch bất kỳ đạo cụ nào vào hình ảnh.', 'AI tự động điều chỉnh ánh sáng, phối cảnh và bóng đổ.', 'Hoàn hảo để thêm phụ kiện, đồ vật hoặc hiệu ứng.'],
    propGuide: ['1. Tải lên ảnh cảnh chính/nhân vật.', '2. Tải lên ảnh đạo cụ.', '3. Chọn một preset phù hợp với bối cảnh.', '4. (Tùy chọn) Hướng dẫn việc tích hợp bằng prompt.', '5. Nhấn "Tạo ảnh"!'],
    propTips: ['Sử dụng ảnh đạo cụ có nền sạch hoặc trong suốt.', 'Để có kết quả tốt nhất, hãy đảm bảo phối cảnh của đạo cụ tương tự ảnh chính.', 'Mô tả cách đạo cụ tương tác với cảnh trong prompt tích cực.'],
    designFeatures: ['Hòa trộn chủ thể với nền nghệ thuật.', 'Áp dụng nhiều phong cách nghệ thuật.', 'Preset Controller v3 cho đầu ra 8K điện ảnh.'],
    designGuide: ['1. Tải lên ảnh chủ thể rõ nét.', '2. Tải lên ảnh nền mong muốn.', '3. Chọn một preset để định hình phong cách.', '4. (Tùy chọn) Viết thêm prompt để tinh chỉnh.', '5. Nhấn "Tạo ảnh" và chờ kết quả!'],
    designTips: ['Sử dụng ảnh chủ thể đã tách nền (PNG) để có kết quả tốt nhất.', 'Các preset "Art" và "Fantasy" tạo ra hiệu ứng ấn tượng.', 'Hãy thử nghiệm với các prompt tích cực và tiêu cực khác nhau.'],
    creativeFeatures: ['Biến mô tả văn bản của bạn thành hình ảnh tuyệt đẹp.', 'Tận dụng các preset mạnh mẽ cho các phong cách cụ thể.', 'Kiểm soát hoàn toàn tỷ lệ khung hình và chi tiết.'],
    creativeGuide: ['1. Viết mô tả chi tiết về hình ảnh bạn muốn.', '2. Chọn một preset phù hợp với ý tưởng của bạn (VD: Viễn tưởng, Chân dung).', '3. Chọn tỷ lệ khung hình mong muốn.', '4. Sử dụng prompt tiêu cực để loại bỏ các yếu tố không mong muốn.', '5. Nhấn "Tạo ảnh"!'],
    creativeTips: ['Hãy cụ thể! Thay vì "một chiếc xe", hãy thử "một chiếc xe thể thao mui trần màu đỏ thập niên 1960".', 'Sử dụng dấu phẩy để kết hợp các khái niệm khác nhau.', 'Tùy chọn "Làm đẹp da" hoạt động rất tốt để tạo nhân vật.'],
    stylistFeatures: ['Thử bất kỳ trang phục nào trên người mẫu ngay lập tức.', 'Kết cấu và độ rủ của vải chân thực.', 'Duy trì danh tính và tư thế của người mẫu.'],
    stylistGuide: ['1. Tải lên ảnh toàn thân của người mẫu.', '2. Tải lên ảnh rõ nét của trang phục.', '3. Chọn một preset liên quan đến thời trang.', '4. (Tùy chọn) Chỉ định loại vải trong prompt.', '5. Nhấn "Tạo ảnh"!'],
    stylistTips: ['Sử dụng ảnh chụp chính diện, rõ nét của cả người mẫu và trang phục.', 'Nền đơn giản hoạt động tốt nhất cho cả hai hình ảnh.', 'Đảm bảo ảnh trang phục hiển thị toàn bộ món đồ.'],
    architectFeatures: ['Biến phác thảo 2D thành ảnh render 3D chân thực.', 'Hỗ trợ thiết kế nội thất và ngoại thất.', 'Ánh sáng điện ảnh và vật liệu chất lượng cao.'],
    architectGuide: ['1. Tải lên bản thiết kế hoặc phác thảo kiến trúc.', '2. Chọn một preset phù hợp (VD: Ngoại thất, Nội thất).', '3. Dùng prompt để chỉ định vật liệu, thời gian trong ngày và tâm trạng.', '4. (Tùy chọn) Dùng prompt tiêu cực để tránh hình ảnh trông như hoạt hình.', '5. Nhấn "Tạo ảnh"!'],
    architectTips: ['Bản vẽ có đường nét sạch, độ tương phản cao hoạt động tốt nhất.', 'Chỉ định vật liệu như "sàn gỗ sồi", "tường bê tông".', 'Về ánh sáng, hãy thử các prompt như "ánh sáng giờ vàng" hoặc "ánh sáng buổi sáng dịu nhẹ".'],
    magicFeatures: ['Cải thiện ảnh chỉ với một cú nhấp.', 'Kết hợp nhiều hiệu ứng như làm đẹp và phục chế.', 'AI tiên tiến đảm bảo nhận dạng của chủ thể được bảo toàn hoàn hảo.'],
    magicGuide: ['1. Tải lên ảnh bạn muốn chỉnh sửa.', '2. Bật các tính năng bạn muốn áp dụng (VD: Làm đẹp, Phục chế).', '3. Đảm bảo "Giữ nguyên đường nét" được bật cho ảnh chân dung.', '4. Nhấn "Tạo ảnh" để xem điều kỳ diệu!'],
    magicTips: ['Hoạt động tốt nhất với ảnh có một chủ thể chính.', 'Tính năng "Phục chế" rất mạnh mẽ cho ảnh gia đình được quét.', 'Kết hợp các tính năng để tân trang ảnh toàn diện.'],
    upscaleFeatures: ['Tăng đáng kể độ phân giải ảnh (gấp 4 lần hoặc hơn).', 'Tạo ra các chi tiết và kết cấu mới, siêu thực.', 'Hoàn hảo để chuẩn bị ảnh cho in ấn hoặc hiển thị độ phân giải cao.'],
    upscaleGuide: ['1. Tải lên hình ảnh bạn muốn nâng cấp.', '2. (Tùy chọn) Điều chỉnh tỷ lệ khung hình hoặc định dạng đầu ra.', '3. Nhấp vào "Tạo ảnh" để bắt đầu quá trình.'],
    upscaleTips: ['Bắt đầu với ảnh gốc có chất lượng cao nhất để có kết quả tốt nhất.', 'Quá trình này có thể mất nhiều thời gian hơn các chỉnh sửa khác do phải tạo chi tiết phức tạp.', 'Kích thước tệp kết quả sẽ lớn hơn đáng kể.'],
    backgroundFeatures: ['Xóa nền chỉ bằng một cú nhấp chuột.', 'Xuất ra file PNG độ phân giải cao với nền trong suốt.', 'Hoàn hảo cho ảnh sản phẩm, chân dung, và nhiều hơn nữa.'],
    backgroundGuide: ['1. Tải lên hình ảnh bạn muốn chỉnh sửa.', '2. Nhấp vào "Tạo ảnh"!', '3. Tải xuống hình ảnh của bạn với nền trong suốt.'],
    backgroundTips: ['Sử dụng hình ảnh có chủ thể rõ ràng để có kết quả tốt nhất.', 'Đầu ra là file PNG, hoàn hảo để đặt trên nền mới.', 'Ảnh đầu vào có độ phân giải cao sẽ tạo ra ảnh đầu ra có độ phân giải cao.'],
    placementFeatures: ['Đặt bất kỳ sản phẩm nào vào mọi bối cảnh với độ chân thực tuyệt vời.', 'AI tự động điều chỉnh phối cảnh, ánh sáng và bóng đổ.', 'Lý tưởng để tạo mockup sản phẩm và quảng cáo chuyên nghiệp.'],
    placementGuide: ['1. Tải lên ảnh bối cảnh của bạn.', '2. Tải lên ảnh sản phẩm của bạn (nền trong suốt là tốt nhất).', '3. Chọn một preset "Sản phẩm" hoặc "Thương mại".', '4. Sử dụng prompt để hướng dẫn vị trí, ví dụ: "đặt chai nước lên bàn gỗ".', '5. Nhấn "Tạo ảnh"!'],
    placementTips: ['Sử dụng ảnh bối cảnh và sản phẩm chất lượng cao.', 'Sản phẩm có nền trong suốt (PNG) cho kết quả tốt nhất.', 'Hãy cụ thể trong prompt tích cực về vị trí và cách đặt sản phẩm.'],
    // Video Tool
    generateVideo: 'Tạo Video',
    generatingVideo: 'Đang tạo Video...',
    videoResult: 'Kết quả Video',
    generationMode: 'Chế độ tạo',
    textToVideo: 'Văn bản thành Video',
    imageToVideo: 'Ảnh thành Video',
    videoWillAppear: 'Video được tạo của bạn sẽ xuất hiện ở đây.',
    videoInProgress: 'Đang tạo video...',
    videoInProgressCompose: 'Bước 1: Dựng bối cảnh...||Bước 2: Tạo video...',
    videoTakesTime: 'Quá trình này có thể mất vài phút.',
    videoAspectRatio: 'Tỷ lệ Khung hình',
    videoQuality: 'Chất lượng',
    portrait: 'Dọc',
    landscape: 'Ngang',
    hd720: '720p (HD)',
    hd1080: '1080p (Full HD)',
    videoPromptRequired: 'Vui lòng nhập mô tả cho video.',
    videoImageRequired: 'Vui lòng tải lên hình ảnh cho chế độ Ảnh thành Video.',
    videoImageRequiredBoth: 'Vui lòng tải lên cả ảnh Nhân vật và Bối cảnh.',
    videoAspectSquare: '1:1 (Vuông)',
    // Magic Tool
    magicBeautify: 'Làm đẹp da',
    magicBeautifyDesc: 'Làm mịn da, xóa mụn và khuyết điểm.',
    magicRestore: 'Phục chế ảnh cũ',
    magicRestoreDesc: 'Sửa ảnh mờ, vết xước, và màu bị phai.',
    preserveIdentity: 'Giữ nguyên đường nét',
    preserveIdentityDesc: 'Tuyệt đối giữ lại các đặc điểm khuôn mặt gốc.',
    errorNoMagicFeature: 'Vui lòng chọn ít nhất một tính năng ma thuật hoặc nhập prompt.',
    // Upscale Tool
    upscaleLevelLabel: 'Mức độ Nâng cấp',
    upscaleSkinStyleLabel: 'Phong cách Render Da',
    skinStyle_Beauty_Smooth: 'Làm đẹp Mịn màng (Thương mại)',
    skinStyle_High_Fidelity_Realism: 'Siêu chân thực (Tự nhiên Điện ảnh)',
    skinStyle_Hybrid_Luxury: 'Sang trọng Lai (Bóng & Tự nhiên)',
    // Batch Tool
    batchProject: 'Tài sản Dự án',
    batchUploadAssets: 'Tải lên Tài sản Dự án',
    batchPrompts: 'Nhập Prompts (mỗi prompt một dòng)',
    batchPromptsPlaceholder: 'Người đàn ông và phụ nữ nhìn một ngôi đền cổ...\nNgười đàn ông ôm người phụ nữ từ phía sau...',
    batchStart: 'Bắt đầu tạo ảnh',
    batchStop: 'Dừng lại',
    batchGenerating: 'Đang tạo hàng loạt...',
    batchStopped: 'Đã dừng',
    batchCompleted: 'Đã hoàn thành',
    batchResults: 'Kết quả Tạo ảnh Hàng loạt',
    batchNoAssets: 'Vui lòng tải lên ít nhất một tài sản nhân vật và một tài sản bối cảnh.',
    batchNoPrompts: 'Vui lòng nhập ít nhất một prompt.',
    batchCharacter: 'Nhân vật',
    batchBackground: 'Bối cảnh',
    batchStyle: 'Phong cách',
  },
};

// --- API Context ---
interface IApiContext {
    ai: GoogleGenAI | null;
    apiKey: string;
    isKeySet: boolean;
}

const ApiContext = createContext<IApiContext | null>(null);

const useApi = () => {
    const context = useContext(ApiContext);
    if (!context) {
        throw new Error("useApi must be used within an ApiProvider");
    }
    return context;
};

const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const apiKey = process.env.API_KEY || '';
    
    const ai = useMemo(() => {
        if (apiKey) {
            try {
                return new GoogleGenAI({ apiKey });
            } catch (e) {
                console.error("Failed to initialize GoogleGenAI:", e);
                return null;
            }
        }
        return null;
    }, [apiKey]);
    
    const contextValue = useMemo(() => ({
        ai,
        apiKey,
        isKeySet: !!apiKey,
    }), [ai, apiKey]);

    return (
        <ApiContext.Provider value={contextValue}>
            {children}
        </ApiContext.Provider>
    );
};

// --- Gemini API Service ---
class ApiAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ApiAuthError';
    }
}

const isAuthError = (err: any): boolean => {
    const message = (err.message || '').toLowerCase();
    const status = err.status || err.cause?.status;
    return (
        message.includes('api key not valid') ||
        message.includes('permission denied') ||
        message.includes('429') ||
        status === 400 ||
        status === 403 ||
        status === 429
    );
};

const callApi = async (apiLogic: () => Promise<any>) => {
    try {
        return await apiLogic();
    } catch (err: any) {
        if (isAuthError(err)) {
            throw new ApiAuthError('API request failed. Please check your API key and quota.');
        }
        throw err;
    }
};

const translateText = async (ai: GoogleGenAI, text: string, sourceLang: string, targetLang: string): Promise<string> => {
    const systemInstruction = `You are an expert translator. You will be given text in ${sourceLang}. Your task is to translate it to ${targetLang}. Respond with only the translated text, without any additional explanations, introductions, or conversational phrases.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: text,
        config: {
            systemInstruction,
            temperature: 0.1,
        },
    });
    
    return response.text.trim();
};

const generateImage = async (ai: GoogleGenAI, parts: any[]) => {
  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts },
      config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
  });

  const content = response?.candidates?.[0]?.content;
  if (!content || !content.parts || content.parts.length === 0) {
    const blockReason = response?.promptFeedback?.blockReason;
    if (blockReason) {
        throw new Error(`Image generation failed due to: ${blockReason}. Please modify your prompt or images.`);
    }
    throw new Error("Image generation failed. The prompt may have been blocked by safety settings or the API returned an empty response. Please try again.");
  }

  for (const part of content.parts) {
      if (part.inlineData && part.inlineData.data && part.inlineData.data.length > 200) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
  }
  throw new Error("No valid image found in response. The result may have been empty or blocked by safety settings.");
};

const generateImageFromText = async (ai: GoogleGenAI, prompt: string, negativePrompt: string, config: {aspectRatio: string, outputMimeType: OutputFormat}) => {
    const fullPrompt = `${prompt} ${negativePrompt ? ` | Negative: ${negativePrompt}` : ''}`;
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: fullPrompt,
        config: {
            numberOfImages: 1,
            outputMimeType: config.outputMimeType || 'image/jpeg',
            aspectRatio: config.aspectRatio && config.aspectRatio !== 'auto' ? config.aspectRatio : '1:1',
        },
    });

    if (response.generatedImages && response.generatedImages[0]) {
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        return `data:${config.outputMimeType || 'image/jpeg'};base64,${base64ImageBytes}`;
    }
    
    throw new Error("No image found in text-to-image response");
};

const generateVideo = async (ai: GoogleGenAI, apiKey: string, prompt: string, imagePart: UploadedImage['apiPayload'] | null = null, quality: VideoQuality, aspectRatio: VideoAspectRatio) => {
    const request: any = {
        model: 'veo-2.0-generate-001',
        prompt,
        config: { numberOfVideos: 1, quality, aspectRatio },
        ...(imagePart && {
            image: {
                imageBytes: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType,
            },
        }),
    };
    
    let operation = await ai.models.generateVideos(request);
    
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
    }

    if (operation.error) {
        console.error("Video generation operation failed:", operation.error);
        throw new Error(`Video generation failed: ${operation.error.message || 'Unknown API error'}`);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation failed or no URI returned.");
    }
    
    const response = await fetch(`${downloadLink}&key=${apiKey}`);
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Failed to download video:", response.status, errorBody);
        throw new Error(`Failed to download video file. Status: ${response.status}`);
    }
    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
};

const getImageDimensions = (dataUrl: string): Promise<{width: number, height: number}> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = (err) => {
            reject(new Error("Failed to load image for dimension calculation."));
        };
        img.src = dataUrl;
    });
};

const resizeImageToAspectRatio = (imageData: UploadedImage, targetAspectRatio: string): Promise<UploadedImage> => {
    return new Promise((resolve, reject) => {
        const [w, h] = targetAspectRatio.split(':').map(Number);
        if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
            console.warn(`Invalid aspect ratio: ${targetAspectRatio}. Returning original image.`);
            return resolve(imageData);
        }
        const targetRatio = w / h;

        const img = new Image();
        img.onload = () => {
            const originalRatio = img.width / img.height;
            if (Math.abs(originalRatio - targetRatio) < 0.01) {
                return resolve(imageData);
            }

            let canvasWidth = img.width;
            let canvasHeight = img.height;
            if (originalRatio > targetRatio) {
                canvasHeight = img.width / targetRatio;
            } else {
                canvasWidth = img.height * targetRatio;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(canvasWidth);
            canvas.height = Math.round(canvasHeight);
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));

            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, (canvas.width - img.width) / 2, (canvas.height - img.height) / 2);

            const newDataUrl = canvas.toDataURL(imageData.apiPayload.inlineData.mimeType);
            const newBase64String = newDataUrl.split(',')[1];
            
            resolve({
                dataUrl: newDataUrl,
                apiPayload: {
                    inlineData: {
                        data: newBase64String,
                        mimeType: imageData.apiPayload.inlineData.mimeType,
                    },
                },
            });
        };
        img.onerror = () => reject(new Error("Failed to load image for resizing."));
        img.src = imageData.dataUrl;
    });
};


// --- App Context ---
// Fix: Define helper types to create an overloaded signature for the translation function.
type TranslationsType = typeof TRANSLATIONS['en'];
type ArrayTranslationKeys = { [K in keyof TranslationsType]: TranslationsType[K] extends string[] ? K : never }[keyof TranslationsType];
type StringTranslationKeys = Exclude<keyof TranslationsType, ArrayTranslationKeys>;

interface IAppContext {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    language: Language;
    setLanguage: (lang: Language) => void;
    // Fix: Update the 't' function signature to be overloaded, providing type safety for string and string[] return types.
    t: {
        (key: ArrayTranslationKeys): string[];
        (key: StringTranslationKeys): string;
        (key: string): string | string[]; // Fallback for dynamic keys
    };
}
const AppContext = createContext<IAppContext | null>(null);
const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppContext must be used within an AppProvider");
    }
    return context;
};

// --- UI Components ---
const Header = () => {
  const { theme, setTheme, language, setLanguage, t } = useAppContext();
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  return (
    <header className="bg-light-surface dark:bg-dark-surface shadow-md p-4 flex justify-between items-center border-b border-light-border dark:border-dark-border">
      <h1 className="text-xl font-bold text-light-text dark:text-dark-text">✨ {t('appName')}</h1>
      <div className="flex items-center space-x-2 md:space-x-4">
        <button onClick={toggleTheme} title={t('toggleTheme')} className="text-light-text dark:text-dark-text text-xl">
          <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
         </button>
        <div className="relative">
          <i className="fa-solid fa-globe text-light-text dark:text-dark-text absolute top-1/2 left-3 -translate-y-1/2"></i>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="pl-9 pr-4 py-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary"
            aria-label={t('language')}
          >
            <option value="en">English</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </div>
      </div>
    </header>
  );
};

const Spinner = () => (
  <div className="flex justify-center items-center h-full">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-light-primary dark:border-dark-primary"></div>
   </div>
);

const ImageUploader = ({ onImageUpload, label }: {onImageUpload: (image: UploadedImage) => void, label: string}) => {
  const [image, setImage] = useState<string | null>(null);
  const { t } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const base64String = reader.result.split(',')[1];
          setImage(reader.result);
          onImageUpload({
            apiPayload: {
              inlineData: {
                data: base64String,
                mimeType: file.type,
              },
            },
            dataUrl: reader.result,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => fileInputRef.current?.click();

  return (
    <div>
      <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{label}</label>
      <div
        className={`image-upload-box w-full border-2 border-dashed border-light-border dark:border-dark-border rounded-lg text-center p-4 cursor-pointer hover:bg-light-bg dark:hover:bg-dark-bg ${!image ? 'h-32 flex flex-col items-center justify-center' : ''}`}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {image ? (
          <img src={image} alt="Uploaded preview" className="max-w-full h-auto rounded-md object-contain max-h-48" />
        ) : (
          <>
            <i className="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('dragOrClick')}</p>
          </>
        )}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
        className="hidden"
        accept="image/*"
      />
    </div>
  );
};

const MultiImageUploader = ({ onImagesUpload, label }: { onImagesUpload: (images: UploadedImage[]) => void, label: string }) => {
    const [images, setImages] = useState<UploadedImage[]>([]);
    const { t } = useAppContext();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFilesChange = (files: FileList | null) => {
        if (!files) return;
        const newImages: UploadedImage[] = [];
        const fileArray = Array.from(files);

        let filesToProcess = fileArray.length;
        if (filesToProcess === 0) {
            onImagesUpload([...images, ...newImages]);
            return;
        }

        fileArray.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        const base64String = reader.result.split(',')[1];
                        newImages.push({
                            apiPayload: { inlineData: { data: base64String, mimeType: file.type } },
                            dataUrl: reader.result,
                        });
                    }
                    filesToProcess--;
                    if (filesToProcess === 0) {
                        onImagesUpload([...images, ...newImages]);
                        setImages(prev => [...prev, ...newImages]);
                    }
                };
                reader.readAsDataURL(file);
            } else {
                filesToProcess--;
                 if (filesToProcess === 0) {
                    onImagesUpload([...images, ...newImages]);
                    setImages(prev => [...prev, ...newImages]);
                }
            }
        });
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files) {
            handleFilesChange(e.dataTransfer.files);
        }
    };
    
    const removeImage = (index: number) => {
        const updatedImages = images.filter((_, i) => i !== index);
        setImages(updatedImages);
        onImagesUpload(updatedImages);
    };

    const handleClick = () => fileInputRef.current?.click();

    return (
        <div>
            <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{label}</label>
            <div
                className="w-full border-2 border-dashed border-light-border dark:border-dark-border rounded-lg p-4 hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
            >
                {images.length > 0 && (
                     <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 mb-4">
                        {images.map((image, index) => (
                             <div key={index} className="relative group">
                                <img src={image.dataUrl} alt={`upload-${index}`} className="w-full h-20 object-cover rounded-md" />
                                <button onClick={() => removeImage(index)} className="absolute top-0 right-0 bg-red-600 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="text-center cursor-pointer" onClick={handleClick}>
                    <i className="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{t('dragOrClick')}</p>
                </div>
            </div>
            <input
                type="file"
                ref={fileInputRef}
                multiple
                onChange={(e) => handleFilesChange(e.target.files)}
                className="hidden"
                accept="image/*"
            />
        </div>
    );
};

const ImageComparator = ({ beforeSrc, afterSrc }: { beforeSrc: string, afterSrc: string }) => {
    const [sliderPosition, setSliderPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMove = useCallback((clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        let position = (x / rect.width) * 100;
        position = Math.max(0, Math.min(100, position));
        setSliderPosition(position);
    }, []);

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleEnd = useCallback(() => {
        setIsDragging(false);
    }, []);
    
    const handleDrag = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDragging) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        handleMove(clientX);
    }, [isDragging, handleMove]);

    useEffect(() => {
        window.addEventListener('mousemove', handleDrag);
        window.addEventListener('touchmove', handleDrag);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleDrag);
            window.removeEventListener('touchmove', handleDrag);
            window.addEventListener('mouseup', handleEnd);
            window.addEventListener('touchend', handleEnd);
        };
    }, [handleDrag, handleEnd]);

    return (
        <div ref={containerRef} className="image-comparator select-none">
            <img src={beforeSrc} alt="Before" className="comparator-img-before" draggable="false" />
            <div className="comparator-after" style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}>
                <img src={afterSrc} alt="After" className="comparator-img-after" draggable="false" />
            </div>
            <div 
                className="comparator-slider" 
                style={{ left: `${sliderPosition}%` }}
                onMouseDown={handleStart}
                onTouchStart={handleStart}
            >
                <div className="comparator-handle">
                    <i className="fas fa-arrows-alt-h text-white"></i>
                </div>
            </div>
        </div>
    );
};

const ToolCard = ({ icon, title, description, onClick }: {icon: string, title: string, description: string, onClick: () => void}) => (
  <div
    className="bg-light-surface dark:bg-dark-surface p-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1.5 transition-all duration-300 cursor-pointer border border-light-border dark:border-dark-border"
    onClick={onClick}
  >
    <div className="text-2xl text-light-primary dark:text-dark-primary mb-4">
        <i className={`fas ${icon}`}></i>
      </div>
    <h3 className="text-xl font-bold mb-2 text-light-text dark:text-dark-text">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400">{description}</p>
  </div>
);

const ToolInfo = ({ toolKey }: {toolKey: string}) => {
    const { t } = useAppContext();
    const [activeTab, setActiveTab] = useState('features');

    // Fix: Add a helper to safely get array content from the 't' function, which can return string | string[].
    const getArrayContent = (key: string): string[] => {
        const result = t(key as any);
        return Array.isArray(result) ? result : [];
    }

    const contentForTab: {[key: string]: string[]} = {
        features: getArrayContent(`${toolKey}Features`),
        guide: getArrayContent(`${toolKey}Guide`),
        tips: getArrayContent(`${toolKey}Tips`),
    };
    
    const tabs = [
        { id: 'features', label: t('features'), icon: 'fa-star' },
        { id: 'guide', label: t('guide'), icon: 'fa-book-open' },
        { id: 'tips', label: t('tips'), icon: 'fa-lightbulb' },
    ];
    
    const currentContent = contentForTab[activeTab] || contentForTab['features'];

    return (
        <div className="mb-6">
            <div className="flex border-b-2 border-light-bg dark:border-dark-bg">
                {tabs.map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-3 px-2 text-sm font-semibold flex items-center justify-center transition-colors duration-200 border-b-2 ${activeTab === tab.id ? 'border-light-primary dark:border-dark-primary text-light-primary dark:text-dark-primary' : 'border-transparent text-gray-500 hover:text-light-text dark:hover:text-dark-text'}`}
                    >
                        <i className={`fas ${tab.icon} mr-2`}></i>
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="py-4 text-sm text-light-text dark:text-dark-text">
                <ul className="list-disc pl-5 space-y-1">
                    {Array.isArray(currentContent) && currentContent.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
            </div>
        </div>
    );
};

interface ToggleSwitchProps {
    id: string;
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    label: string;
    description?: string;
}

const ToggleSwitch = ({ id, checked, onChange, disabled, label, description }: ToggleSwitchProps) => (
    <div className="flex items-center justify-between bg-light-bg dark:bg-dark-bg p-3 rounded-lg border border-light-border dark:border-dark-border">
        <div>
            <label htmlFor={id} className="block text-sm font-bold text-light-text dark:text-dark-text cursor-pointer select-none">{label}</label>
            {description && <p className="text-xs text-gray-500 select-none">{description}</p>}
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input
                type="checkbox"
                id={id}
                checked={checked}
                onChange={onChange}
                className="sr-only peer"
                disabled={disabled}
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-light-primary/50 dark:peer-focus:ring-dark-primary/50 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-light-primary dark:peer-checked:bg-dark-primary"></div>
        </label>
    </div>
);


// --- Pages ---
const HomePage = ({ onNavigate }: {onNavigate: (page: Page) => void}) => {
  const { t } = useAppContext();
  const tools = [
    { page: 'lookbook', icon: 'fa-book', title: t('lookbookStudioTitle'), desc: t('lookbookStudioDesc') },
    { page: 'batch', icon: 'fa-layer-group', title: t('batchStudioTitle'), desc: t('batchStudioDesc') },
    { page: 'trendko', icon: 'fa-fire', title: t('trendkoTitle'), desc: t('trendkoDesc') },
    { page: 'pose', icon: 'fa-street-view', title: t('poseStudioTitle'), desc: t('poseStudioDesc') },
    { page: 'prop', icon: 'fa-magic', title: t('propFusionTitle'), desc: t('propFusionDesc') },
    { page: 'placement', icon: 'fa-bullhorn', title: t('productPlacementTitle'), desc: t('productPlacementDesc') },
    { page: 'design', icon: 'fa-palette', title: t('designStudioTitle'), desc: t('designStudioDesc') },
    { page: 'comic', icon: 'fa-mask', title: t('comicStudioTitle'), desc: t('comicStudioDesc') },
    { page: 'creative', icon: 'fa-lightbulb', title: t('creativeStudioTitle'), desc: t('creativeStudioDesc') },
    { page: 'stylist', icon: 'fa-tshirt', title: t('stylistStudioTitle'), desc: t('stylistStudioDesc') },
    { page: 'architect', icon: 'fa-drafting-compass', title: t('architectStudioTitle'), desc: t('architectStudioDesc') },
    { page: 'video', icon: 'fa-video', title: t('videoStudioTitle'), desc: t('videoStudioDesc') },
    { page: 'upscale', icon: 'fa-search-plus', title: t('upscaleStudioTitle'), desc: t('upscaleStudioDesc') },
    { page: 'magic', icon: 'fa-wand-magic-sparkles', title: t('magicStudioTitle'), desc: t('magicStudioDesc') },
    { page: 'background', icon: 'fa-eraser', title: t('backgroundStudioTitle'), desc: t('backgroundStudioDesc') },
  ];

  return (
    <div className="p-8 animate-fade-in">
      <div className="text-center mb-12">
        <h2 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-fuchsia-500 to-purple-600 bg-clip-text text-transparent">{t('homeTitle')}</h2>
        <p className="text-xl text-gray-500 dark:text-gray-300 max-w-2xl mx-auto">{t('homeSubtitle')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {tools.map((tool) => (
          <ToolCard
            key={tool.page}
            icon={tool.icon}
            title={tool.title}
            description={tool.desc}
            onClick={() => onNavigate(tool.page as Page)}
          />
        ))}
      </div>
    </div>
  );
};

const AITrendMaker = ({ onBack }: { onBack: () => void }) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);
    const [secondarySourceImage, setSecondarySourceImage] = useState<UploadedImage | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'9:16' | '1:1' | '16:9'>('9:16');
    const [selectedTrends, setSelectedTrends] = useState<string[]>([]);
    const [results, setResults] = useState<{ trendKey: string; imageUrl: string; }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleTrendToggle = (trendKey: string) => {
        setSelectedTrends(prev =>
            prev.includes(trendKey)
                ? prev.filter(t => t !== trendKey)
                : [...prev, trendKey]
        );
    };
    
    const handleSelectAll = () => setSelectedTrends(Object.keys(TRENDS));
    const handleDeselectAll = () => setSelectedTrends([]);
    
    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        if (!sourceImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên Chủ thể chính.' : 'Please upload the Main Subject.');
            return;
        }
        if (selectedTrends.length === 0) {
            setError(t('noTrendsSelected'));
            return;
        }

        setIsLoading(true);
        setResults([]);
        setError('');

        try {
            const generationPromises = selectedTrends.map(async (trendKey) => {
                const trend = TRENDS[trendKey];
                
                let subjectInstruction;
                const parts: any[] = [sourceImage.apiPayload];

                if (secondarySourceImage) {
                    subjectInstruction = "[SUBJECTS] The main subject is from the first image. The second subject is from the second image. Combine them naturally into the scene as a couple or partners in the trend.";
                    parts.push(secondarySourceImage.apiPayload);
                } else {
                    subjectInstruction = "[SUBJECT] The subject is the person in the provided image.";
                }

                const finalPrompt = `
                    [TASK] Create a viral trend image.

                    ${language === 'vi' ? VIETNAMESE_TEXT_INSTRUCTION : ''}

                    [IDENTITY PRESERVATION]
                    **CRITICAL INSTRUCTION: ABSOLUTE LIKENESS REQUIRED**
                    You MUST strictly preserve the facial features, structure, and identity of the subject(s) from the input image(s). The person in the output MUST be perfectly and instantly recognizable as the same person from the input.

                    **RULES:**
                    1.  **Direct Likeness:** Do NOT create a new person or a "similar-looking" person. The output face must be a direct, photographic likeness of the input face.
                    2.  **No Facial Alterations:** Do NOT alter their fundamental facial structure, including the shape of the eyes, nose, mouth, and jawline.
                    3.  **Preserve Details:** Maintain the original eye color, hair color, and skin tone.

                    **NEGATIVE PROMPT (Things to AVOID):**
                    -   Changing the subject's face.
                    -   Generating a different person.
                    -   Inconsistent facial features.
                    -   Altering the DNA of the character.
                    ${negativePrompt ? `- ${negativePrompt}`: ''}

                    [STYLE INSTRUCTION] ${trend.prompt}
                    ${subjectInstruction}
                    [ASPECT RATIO] The final image MUST have an aspect ratio of ${aspectRatio}.
                    
                    [USER HINTS]
                    Name/Title: ${name || 'Not provided'}
                    Description: ${description || 'Not provided'}
                    
                    [OUTPUT] Generate a single, high-quality image adhering to all instructions, especially the critical identity preservation rules.
                `;
                parts.push({ text: finalPrompt });
                
                const imageUrl = await callApi(() => generateImage(ai, parts));
                return { trendKey, imageUrl };
            });

            const settledResults = await Promise.allSettled(generationPromises);
            
            const successfulResults = settledResults
                .filter(res => res.status === 'fulfilled')
                .map(res => (res as PromiseFulfilledResult<{ trendKey: string; imageUrl: string; }>).value);

            const failedResults = settledResults.filter(res => res.status === 'rejected');
            
            setResults(successfulResults);

            if (failedResults.length > 0) {
                 setError(`${failedResults.length} trend(s) failed to generate. Please try again.`);
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline">
                <i className="fas fa-arrow-left mr-2"></i> {t('goBack')}
            </button>
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h2 className="text-4xl md:text-5xl font-extrabold mb-2 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
                        AI Trend Maker
                    </h2>
                    <p className="text-lg text-gray-500 dark:text-gray-300">
                        Create viral-style images with a single click.
                    </p>
                </div>

                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ImageUploader label={t('uploadSubject')} onImageUpload={setSourceImage} />
                        <ImageUploader label={t('uploadSecondSubject')} onImageUpload={setSecondarySourceImage} />
                    </div>
                    <div>
                        <label htmlFor="nameTitle" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('nameTitle')}</label>
                        <input id="nameTitle" type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('nameTitlePlaceholder')} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                     <div>
                        <label htmlFor="hintDescription" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('hintDescription')}</label>
                        <textarea id="hintDescription" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('hintDescriptionPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                    <div>
                        <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                        <textarea id="negativePrompt" value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} placeholder={t('negativePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                     <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <div className="flex space-x-2 rounded-lg p-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border">
                            {(['9:16', '1:1', '16:9'] as const).map((ratio) => (
                                <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${aspectRatio === ratio ? 'btn-primary text-white' : 'bg-transparent text-light-text dark:text-dark-text hover:bg-light-surface dark:hover:bg-dark-surface'}`}>
                                    {ratio}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-light-text dark:text-dark-text">{t('chooseTrends')}</label>
                            <div>
                                <button onClick={handleSelectAll} className="text-xs font-semibold text-light-primary dark:text-dark-primary hover:underline mr-4">{t('selectAll')}</button>
                                <button onClick={handleDeselectAll} className="text-xs font-semibold text-gray-500 hover:underline">{t('deselectAll')}</button>
                            </div>
                        </div>
                         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {Object.entries(TRENDS).map(([key, trend]) => (
                                <button key={key} onClick={() => handleTrendToggle(key)} className={`p-3 text-sm font-semibold rounded-lg border-2 transition-all duration-200 text-left ${selectedTrends.includes(key) ? 'border-light-primary dark:border-dark-primary bg-light-primary/10 dark:bg-dark-primary/10 text-light-primary dark:text-dark-primary' : 'border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg hover:border-gray-400 dark:hover:border-gray-500'}`}>
                                    {trend.label[language]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                     <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generatingTrends') : t('generateTrends')}
                    </button>
                </div>
                
                {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
                
                {isLoading && (
                    <div className="mt-8 text-center">
                        <Spinner />
                        <p className="mt-4">{t('generatingTrends')}</p>
                    </div>
                )}

                {results.length > 0 && !isLoading && (
                    <div className="mt-8">
                        <h3 className="text-2xl font-bold mb-4 text-light-text dark:text-dark-text text-center">{t('result')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {results.map(({ trendKey, imageUrl }) => (
                                <div key={trendKey} className="bg-light-surface dark:bg-dark-surface rounded-lg shadow-md border border-light-border dark:border-dark-border overflow-hidden">
                                    <img src={imageUrl} alt={TRENDS[trendKey].label[language]} className="w-full h-auto object-cover" />
                                    <div className="p-3">
                                        <h4 className="font-bold text-light-text dark:text-dark-text">{TRENDS[trendKey].label[language]}</h4>
                                        <a href={imageUrl} download={`${trendKey}.png`} className="w-full mt-2 btn-secondary bg-gray-600 hover:bg-gray-500 text-white text-sm font-bold py-2 px-3 rounded-lg flex items-center justify-center">
                                            <i className="fas fa-download mr-2"></i> {t('download')}
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                 <div className="text-center mt-8 text-xs text-gray-500">
                    <p>Powered by Gemini 2.5 Flash Image Preview | Created by M_A.i</p>
                </div>
            </div>
        </div>
    );
};


const LookbookStudio = ({ onBack }: { onBack: () => void }) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    const [images, setImages] = useState<UploadedImage[]>([]);
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
    const [numPages, setNumPages] = useState(4);
    const [preset, setPreset] = useState('wedding');
    const [textContent, setTextContent] = useState('');
    const [positivePrompt, setPositivePrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('blurry, distorted, malformed faces, different person, changing subject DNA');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState<string[]>([]);

    const presets = {
        'wedding': { label: t('lookbookWedding'), prompt: 'The theme is a romantic wedding lookbook. The design should be elegant, soft, and timeless. Use light colors and delicate typography placeholders.' },
        'yearbook': { label: t('lookbookYearbook'), prompt: 'The theme is a graduation yearbook or memory book. The design should be fun, dynamic, and youthful. It can include collage-style layouts and playful graphic elements.' },
        'travel': { label: t('lookbookTravel'), prompt: 'The theme is a travel adventure log. The design should be exciting and cinematic. Use bold typography and layouts that convey a sense of journey and exploration.' },
        'timeline': { label: t('lookbookTimeline'), prompt: 'The theme is a personal timeline, showing a progression of time. The design should be sentimental and narrative-driven. Arrange photos to suggest a story from past to present.' },
    };

    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        if (images.length < 2) {
            setError(t('errorNotEnoughImages'));
            return;
        }
        const pagesToGenerate = Math.max(1, Math.min(numPages, 10)); // Cap at 10 pages

        setIsLoading(true);
        setError('');
        setResults([]);
        
        try {
            const contentLines = textContent.split('\n').filter(line => line.trim() !== '');

            for (let i = 0; i < pagesToGenerate; i++) {
                 const pageContent = contentLines[i] || '';

                 const textInstruction = pageContent
                    ? `**Text Integration:** You MUST use the exact text provided in the '[PAGE CONTENT]' section for this page's headlines and body copy. Arrange and style this text beautifully within the layout. The common format is 'TITLE // BODY'. Use the text before '//' as a prominent headline. Do NOT use 'lorem ipsum' filler text.`
                    : `**Placeholder Text:** Include placeholder text (like 'lorem ipsum') for headlines and body copy. DO NOT generate real, meaningful text. The text should simply act as a design element.`;
                
                 const contentSection = pageContent ? `[PAGE CONTENT] ${pageContent}` : '';

                 const finalPrompt = `
                    [TASK] Your task is to design a single, elegant lookbook page. This is page ${i + 1} of ${pagesToGenerate}.

                    ${language === 'vi' ? VIETNAMESE_TEXT_INSTRUCTION : ''}

                    [IDENTITY PRESERVATION]
                    **CRITICAL INSTRUCTION: ABSOLUTE LIKENESS REQUIRED**
                    You MUST strictly preserve the facial features, structure, and identity of the subject(s) from ALL the provided input images. The people in the output MUST be perfectly and instantly recognizable as the same people.

                    **RULES:**
                    1.  **Direct Likeness:** Do NOT create a new person. The output face must be a direct, photographic likeness of the input faces.
                    2.  **No Facial Alterations:** Do NOT alter their fundamental facial structure, eye color, hair color, or skin tone.

                    [DESIGN INSTRUCTIONS]
                    1.  **Layout:** Create a clean, minimalist, and professional layout inspired by high-end fashion or wedding magazines. Use a balanced composition with ample white space.
                    2.  **Photo Arrangement:** Artistically arrange one or more of the provided photos on the page. You can crop, resize, and position them creatively to create a dynamic composition.
                    3.  ${textInstruction}
                    4.  **Aesthetics:** The overall color palette and mood should be harmonious and sophisticated, complementing the photos.

                    [THEME] ${presets[preset as keyof typeof presets].prompt}
                    [PAGE ORIENTATION] The final page MUST have a ${orientation} orientation. For portrait, use an aspect ratio like 3:4. For landscape, use 4:3.
                    
                    ${contentSection}

                    [USER HINTS]
                    Positive Details: ${positivePrompt || 'None'}
                    
                    [NEGATIVE PROMPT (Things to AVOID)]
                    - Changing the subject's face or identity.
                    - Generating a different person.
                    - Inconsistent facial features.
                    - Altering the DNA of the character.
                    - Ugly, poorly designed, cluttered layout.
                    - Using 'lorem ipsum' if real text is provided in [PAGE CONTENT].
                    - Generating real content if no text is provided (use lorem ipsum instead).
                    ${negativePrompt ? `- ${negativePrompt}`: ''}
                `;
                
                const parts = [
                    ...images.map(img => img.apiPayload),
                    { text: finalPrompt }
                ];
                
                const imageUrl = await callApi(() => generateImage(ai, parts));
                setResults(prev => [...prev, imageUrl]);
            }
        } catch (err: any) {
             console.error(err);
             setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 animate-fade-in">
             <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline">
                <i className="fas fa-arrow-left mr-2"></i> {t('goBack')}
            </button>
            <div className="max-w-6xl mx-auto">
                 <div className="text-center mb-8">
                    <h2 className="text-4xl md:text-5xl font-extrabold mb-2 bg-gradient-to-r from-blue-400 via-teal-500 to-green-500 bg-clip-text text-transparent">
                        {t('lookbookStudioTitle')}
                    </h2>
                    <p className="text-lg text-gray-500 dark:text-gray-300">{t('lookbookStudioDesc')}</p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                        <MultiImageUploader label={t('uploadMultipleImages')} onImagesUpload={setImages} />
                        
                        <div>
                            <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('preset')}</label>
                            <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                                {Object.entries(presets).map(([key, value]) => (
                                    <option key={key} value={key}>{value.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('pageOrientation')}</label>
                             <div className="flex space-x-2 rounded-lg p-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border">
                                <button onClick={() => setOrientation('portrait')} className={`w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors ${orientation === 'portrait' ? 'btn-primary text-white' : 'bg-transparent'}`}>{t('portrait')}</button>
                                <button onClick={() => setOrientation('landscape')} className={`w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors ${orientation === 'landscape' ? 'btn-primary text-white' : 'bg-transparent'}`}>{t('landscape')}</button>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="numPages" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('numberOfPages')}</label>
                            <input id="numPages" type="number" value={numPages} onChange={e => setNumPages(Math.max(1, parseInt(e.target.value, 10) || 1))} min="1" max="10" className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md" />
                        </div>
                        
                        <div>
                            <label htmlFor="lookbook-content" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('lookbookContent')}</label>
                            <textarea id="lookbook-content" value={textContent} onChange={e => setTextContent(e.target.value)} rows={4} placeholder={t('lookbookContentPlaceholder')} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md" />
                        </div>

                        <div>
                            <label htmlFor="lookbook-positive" className="block text-sm font-bold mb-2">{t('positivePrompt')}</label>
                            <textarea id="lookbook-positive" value={positivePrompt} onChange={e => setPositivePrompt(e.target.value)} rows={3} placeholder={t('positivePromptPlaceholder')} className="w-full p-2 bg-light-bg dark:bg-dark-bg border rounded-md" />
                        </div>
                        
                        <div>
                            <label htmlFor="lookbook-negative" className="block text-sm font-bold mb-2">{t('negativePrompt')}</label>
                            <textarea id="lookbook-negative" value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} rows={3} placeholder={t('negativePromptPlaceholder')} className="w-full p-2 bg-light-bg dark:bg-dark-bg border rounded-md" />
                        </div>
                        
                        <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 rounded-lg flex items-center justify-center disabled:opacity-50">
                            <i className="fas fa-book-open mr-2"></i>
                            {isLoading ? t('generatingLookbook') : t('generateLookbook')}
                        </button>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border min-h-[400px]">
                             <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text text-center">{t('result')}</h3>
                             {isLoading && results.length === 0 && <Spinner />}
                             {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
                             <div className={`grid gap-4 ${orientation === 'portrait' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                                {results.map((src, index) => (
                                    <div key={index} className="group relative">
                                        <img src={src} alt={`Page ${index + 1}`} className="w-full h-auto rounded-lg shadow-md" />
                                         <a href={src} download={`lookbook-page-${index+1}.png`} className="absolute bottom-2 right-2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                            <i className="fas fa-download"></i>
                                        </a>
                                    </div>
                                ))}
                                {isLoading && results.length > 0 && <div className="flex justify-center items-center"><Spinner /></div>}
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PoseStudio = ({ onBack }: { onBack: () => void }) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    const [characterImage, setCharacterImage] = useState<UploadedImage | null>(null);
    const [poseImage, setPoseImage] = useState<UploadedImage | null>(null);
    const [positivePrompt, setPositivePrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [preset, setPreset] = useState(Object.keys(PRESETS)[0]);
    const [beauty, setBeauty] = useState<'on' | 'off'>(PRESETS[preset].beauty);
    const [controlMode, setControlMode] = useState<ControlMode>('Pose');
    const [aspectRatio, setAspectRatio] = useState('auto');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        setBeauty(PRESETS[preset].beauty);
    }, [preset]);

    const isBeautyAvailable = useMemo(() => PRESETS[preset].beauty === 'on', [preset]);

    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        if (!characterImage || !poseImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên cả hai hình ảnh.' : 'Please upload both images.');
            return;
        }
        setIsLoading(true);
        setResultImage(null);
        setError('');
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }

            const presetDirective = buildPresetDirective(preset, { aspect: aspectRatio, beauty });
            const finalPrompt = `
                ${presetDirective}\n\n
                [USER_PROMPT]
                Positive: ${finalPositivePrompt}
                Negative: ${finalNegativePrompt}
                Control Mode: ${controlMode}
                Output-Format: ${outputFormat.split('/')[1]}
            `;

            const parts = [
                characterImage.apiPayload,
                poseImage.apiPayload,
                { text: finalPrompt },
            ];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline">
                <i className="fas fa-arrow-left mr-2"></i> {t('goBack')}
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="pose" />
                    <ImageUploader label={t('uploadCharacter')} onImageUpload={setCharacterImage} />
                    <ImageUploader label={t('uploadPose')} onImageUpload={setPoseImage} />
                    
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('preset')}</label>
                        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {Object.entries(PRESETS).map(([key, value]) => (
                                <option key={key} value={key}>{value.label[language as Language]}</option>
                            ))}
                        </select>
                    </div>

                     <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           {ASPECT_RATIOS.map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <label htmlFor="beautify-toggle-pose" className="block text-sm font-bold text-light-text dark:text-dark-text">
                            {t('beautify')}
                            {!isBeautyAvailable && <span className="text-xs font-normal text-gray-500 ml-2">{t('beautifyHint')}</span>}
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                id="beautify-toggle-pose"
                                checked={beauty === 'on'} 
                                onChange={(e) => setBeauty(e.target.checked ? 'on' : 'off')} 
                                className="sr-only peer" 
                                disabled={!isBeautyAvailable}
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-light-primary/50 dark:peer-focus:ring-dark-primary/50 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-light-primary dark:peer-checked:bg-dark-primary"></div>
                        </label>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('controlMode')}</label>
                        <div className="flex space-x-2 rounded-lg p-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border">
                            {CONTROL_MODES.map((mode) => (
                                <button
                                key={mode}
                                onClick={() => setControlMode(mode)}
                                className={`w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
                                    controlMode === mode
                                    ? 'btn-primary text-white'
                                    : 'bg-transparent text-light-text dark:text-dark-text hover:bg-light-surface dark:hover:bg-dark-surface'
                                }`}
                                >
                                {t(`controlMode${mode}`)}
                                </button>
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400 min-h-[2.5em] px-1">
                          {t(`controlModeDesc_${controlMode}` as any)}
                        </p>
                    </div>

                    <div>
                      <label htmlFor="positivePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                      <textarea
                          id="positivePrompt"
                          value={positivePrompt}
                          onChange={(e) => setPositivePrompt(e.target.value)}
                          placeholder={t('positivePromptPlaceholder')}
                          rows={3}
                          className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                      />
                    </div>
                    <div>
                      <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                      <textarea
                          id="negativePrompt"
                          value={negativePrompt}
                          onChange={(e) => setNegativePrompt(e.target.value)}
                          placeholder={t('negativePromptPlaceholder')}
                          rows={3}
                          className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                      />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage && characterImage ? <ImageComparator beforeSrc={characterImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIStylist = ({ onBack }: {onBack: () => void}) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    const [modelImage, setModelImage] = useState<UploadedImage | null>(null);
    const [accessoryImages, setAccessoryImages] = useState<UploadedImage[]>([]);
    const [sceneDescription, setSceneDescription] = useState('');
    const [positivePrompt, setPositivePrompt] = useState(() => t('stylistPositiveDefault'));
    const [negativePrompt, setNegativePrompt] = useState(() => t('stylistNegativeDefault'));
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    const prevLangRef = useRef(language);
    useEffect(() => {
        if (prevLangRef.current !== language) {
            setPositivePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['stylistPositiveDefault']
                    ? t('stylistPositiveDefault')
                    : currentPrompt
            );
            setNegativePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['stylistNegativeDefault']
                    ? t('stylistNegativeDefault')
                    : currentPrompt
            );
            prevLangRef.current = language;
        }
    }, [language, t]);
    
    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        if (!modelImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên Ảnh Nhân Vật Chính.' : 'Please upload the Main Character Image.');
            return;
        }
        if (accessoryImages.length === 0 && !sceneDescription.trim()) {
            setError(language === 'vi' ? 'Vui lòng tải lên ít nhất một trang phục hoặc mô tả bối cảnh.' : 'Please upload at least one accessory or describe a scene.');
            return;
        }
        setIsLoading(true);
        setResultImage(null);
        setError('');
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;
            let finalSceneDescription = sceneDescription;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
                if (sceneDescription.trim()) finalSceneDescription = await callApi(() => translateText(ai, sceneDescription, 'Vietnamese', 'English'));
            }

            const { width, height } = await getImageDimensions(modelImage.dataUrl);
            const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
            const divisor = gcd(width, height);
            const aspectRatio = `${width / divisor}:${height / divisor}`;
            
            const finalPrompt = `
                [TASK] This is an advanced virtual try-on and scene composition task. Your goal is to dress the main subject with the provided accessories and place them in the described scene.

                [IDENTITY PRESERVATION]
                **CRITICAL INSTRUCTION: ABSOLUTE LIKENESS REQUIRED**
                You MUST strictly preserve the facial features, structure, and identity of the subject from the first input image. The person in the output MUST be perfectly and instantly recognizable as the same person.
                - DO NOT change their face.
                - DO NOT generate a different person.
                - PRESERVE original pose, body shape, hair, and skin tone.

                [INPUTS]
                - The **first image** is the [MAIN SUBJECT].
                - All **subsequent images** are [ACCESSORIES] (clothing, jewelry, items, etc.).

                [INSTRUCTIONS]
                1.  **Dress the Subject:** Realistically place all [ACCESSORIES] onto the [MAIN SUBJECT]. The clothes should fit naturally, with correct draping, shadows, and lighting.
                2.  **Compose the Scene:** Place the fully dressed subject into the environment described in [SCENE DESCRIPTION]. If no scene is described, create a simple, neutral studio background that complements the outfit.
                3.  **Maintain Consistency:** The final image's lighting, photographic style, and quality should be cohesive and hyper-realistic. The aspect ratio must be ${aspectRatio}.

                [SCENE DESCRIPTION]
                ${finalSceneDescription || 'A clean, minimalist studio background.'}

                [USER HINTS]
                - Positive: ${finalPositivePrompt}
                - Negative (AVOID): ${finalNegativePrompt}

                [OUTPUT] Generate a single, high-quality image adhering to all instructions.
            `;

            const parts = [
                modelImage.apiPayload,
                ...accessoryImages.map(img => img.apiPayload),
                { text: finalPrompt },
            ];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline">
                <i className="fas fa-arrow-left mr-2"></i> {t('goBack')}
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <h2 className="text-2xl font-bold text-center">{t('stylistStudioTitle')}</h2>
                    <ImageUploader label={t('stylistCharacter')} onImageUpload={setModelImage} />
                    <MultiImageUploader label={t('stylistAccessories')} onImagesUpload={setAccessoryImages} />
                    
                    <div>
                      <label htmlFor="scene-description" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('stylistSceneDescription')}</label>
                      <textarea
                          id="scene-description"
                          value={sceneDescription}
                          onChange={(e) => setSceneDescription(e.target.value)}
                          placeholder={t('stylistSceneDescriptionPlaceholder')}
                          rows={3}
                          className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                      />
                    </div>

                    <div>
                      <label htmlFor="positivePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                      <textarea
                          id="positivePrompt"
                          value={positivePrompt}
                          onChange={(e) => setPositivePrompt(e.target.value)}
                          placeholder={t('positivePromptPlaceholder')}
                          rows={3}
                          className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                      />
                    </div>
                    <div>
                      <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                      <textarea
                          id="negativePrompt"
                          value={negativePrompt}
                          onChange={(e) => setNegativePrompt(e.target.value)}
                          placeholder={t('negativePromptPlaceholder')}
                          rows={3}
                          className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                      />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full min-h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                            {isLoading ? (
                                <Spinner />
                            ) : resultImage ? (
                                <img src={resultImage} alt={t('result')} className="object-contain max-h-full max-w-full rounded-lg" />
                            ) : (
                                <p className="text-gray-500">{t('preview')}</p>
                            )}
                         </div>
                         {error && <p className="text-red-500 mt-4">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PropFusion = ({ onBack }: {onBack: () => void}) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    const [characterImage, setCharacterImage] = useState<UploadedImage | null>(null);
    const [propImage, setPropImage] = useState<UploadedImage | null>(null);
    const [positivePrompt, setPositivePrompt] = useState(() => t('propFusionPositiveDefault'));
    const [negativePrompt, setNegativePrompt] = useState(() => t('propFusionNegativeDefault'));
    const [preset, setPreset] = useState('portrait-studio');
    const [aspectRatio, setAspectRatio] = useState('auto');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    const [beauty, setBeauty] = useState<'on' | 'off'>(PRESETS[preset].beauty);
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string|null>(null);
    const [error, setError] = useState('');

    const prevLangRef = useRef(language);
    useEffect(() => {
        if (prevLangRef.current !== language) {
            setPositivePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['propFusionPositiveDefault']
                    ? t('propFusionPositiveDefault')
                    : currentPrompt
            );
            setNegativePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['propFusionNegativeDefault']
                    ? t('propFusionNegativeDefault')
                    : currentPrompt
            );
            prevLangRef.current = language;
        }
    }, [language, t]);

    useEffect(() => {
        setBeauty(PRESETS[preset].beauty);
    }, [preset]);

    const isBeautyAvailable = useMemo(() => PRESETS[preset].beauty === 'on', [preset]);

    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        if (!characterImage || !propImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên ảnh nhân vật và đạo cụ.' : 'Please upload both character and prop images.');
            return;
        }
        setIsLoading(true);
        setResultImage(null);
        setError('');
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }

            const presetDirective = buildPresetDirective(preset, { beauty, aspect: aspectRatio });
            const finalPrompt = `
                ${presetDirective}\n\n
                [USER_PROMPT]
                instruction: Seamlessly and realistically integrate the object from the second image (prop) into the first image (character/scene). Match the lighting, shadows, and perspective.
                Positive: ${finalPositivePrompt}
                Negative: ${finalNegativePrompt}
                Output-Format: ${outputFormat.split('/')[1]}
            `;
            const parts = [characterImage.apiPayload, propImage.apiPayload, { text: finalPrompt }];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="prop" />
                    <ImageUploader label={t('uploadCharacter')} onImageUpload={setCharacterImage} />
                    <ImageUploader label={t('uploadProp')} onImageUpload={setPropImage} />
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('preset')}</label>
                        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {Object.entries(PRESETS).map(([key, value]) => (<option key={key} value={key}>{value.label[language as Language]}</option>))}
                        </select>
                    </div>

                     <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           {ASPECT_RATIOS.map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <label htmlFor="beautify-toggle-prop" className="block text-sm font-bold text-light-text dark:text-dark-text">
                            {t('beautify')}
                            {!isBeautyAvailable && <span className="text-xs font-normal text-gray-500 ml-2">{t('beautifyHint')}</span>}
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                id="beautify-toggle-prop"
                                checked={beauty === 'on'} 
                                onChange={(e) => setBeauty(e.target.checked ? 'on' : 'off')} 
                                className="sr-only peer" 
                                disabled={!isBeautyAvailable}
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-light-primary/50 dark:peer-focus:ring-dark-primary/50 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-light-primary dark:peer-checked:bg-dark-primary"></div>
                        </label>
                    </div>

                    <div>
                      <label htmlFor="positivePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                      <textarea id="positivePrompt" value={positivePrompt} onChange={(e) => setPositivePrompt(e.target.value)} placeholder={t('positivePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                    <div>
                      <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                      <textarea id="negativePrompt" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder={t('negativePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage && characterImage ? <ImageComparator beforeSrc={characterImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ProductPlacement = ({ onBack }: {onBack: () => void}) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    const [sceneImage, setSceneImage] = useState<UploadedImage | null>(null);
    const [productImage, setProductImage] = useState<UploadedImage | null>(null);
    const [positivePrompt, setPositivePrompt] = useState(() => t('productPlacementPositiveDefault'));
    const [negativePrompt, setNegativePrompt] = useState(() => t('productPlacementNegativeDefault'));
    const [preset, setPreset] = useState('product-commercial');
    const [aspectRatio, setAspectRatio] = useState('auto');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string|null>(null);
    const [error, setError] = useState('');

    const prevLangRef = useRef(language);
    useEffect(() => {
        if (prevLangRef.current !== language) {
            setPositivePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['productPlacementPositiveDefault']
                    ? t('productPlacementPositiveDefault')
                    : currentPrompt
            );
            setNegativePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['productPlacementNegativeDefault']
                    ? t('productPlacementNegativeDefault')
                    : currentPrompt
            );
            prevLangRef.current = language;
        }
    }, [language, t]);

    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        if (!sceneImage || !productImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên cả ảnh bối cảnh và sản phẩm.' : 'Please upload both scene and product images.');
            return;
        }
        setIsLoading(true);
        setResultImage(null);
        setError('');
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }

            const presetDirective = buildPresetDirective(preset, { aspect: aspectRatio });
            const finalPrompt = `
                ${presetDirective}\n\n
                [USER_PROMPT]
                instruction: This is a product placement task. Your goal is to seamlessly and realistically place the object from the second image (the product) into the first image (the scene). You MUST match the scene's lighting, shadows, perspective, and scale perfectly. The product should look like it naturally belongs in the environment.
                Positive: ${finalPositivePrompt}
                Negative: ${finalNegativePrompt}
                Output-Format: ${outputFormat.split('/')[1]}
            `;
            const parts = [sceneImage.apiPayload, productImage.apiPayload, { text: finalPrompt }];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="placement" />
                    <ImageUploader label={t('uploadScene')} onImageUpload={setSceneImage} />
                    <ImageUploader label={t('uploadProduct')} onImageUpload={setProductImage} />
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('preset')}</label>
                        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {Object.entries(PRESETS).map(([key, value]) => (<option key={key} value={key}>{value.label[language as Language]}</option>))}
                        </select>
                    </div>

                     <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           {ASPECT_RATIOS.map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>
                    
                    <div>
                      <label htmlFor="positivePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                      <textarea id="positivePrompt" value={positivePrompt} onChange={(e) => setPositivePrompt(e.target.value)} placeholder={t('positivePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                    <div>
                      <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                      <textarea id="negativePrompt" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder={t('negativePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage && sceneImage ? <ImageComparator beforeSrc={sceneImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIDesign = ({ onBack }: {onBack: () => void}) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    const [subjectImage, setSubjectImage] = useState<UploadedImage | null>(null);
    const [backgroundImage, setBackgroundImage] = useState<UploadedImage | null>(null);
    const [positivePrompt, setPositivePrompt] = useState(() => t('designPositiveDefault'));
    const [negativePrompt, setNegativePrompt] = useState(() => t('designNegativeDefault'));
    const [preset, setPreset] = useState('art-fantasy');
    const [aspectRatio, setAspectRatio] = useState('auto');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    const [beauty, setBeauty] = useState<'on' | 'off'>(PRESETS[preset].beauty);
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    const prevLangRef = useRef(language);
    useEffect(() => {
        if (prevLangRef.current !== language) {
            setPositivePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['designPositiveDefault']
                    ? t('designPositiveDefault')
                    : currentPrompt
            );
            setNegativePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['designNegativeDefault']
                    ? t('designNegativeDefault')
                    : currentPrompt
            );
            prevLangRef.current = language;
        }
    }, [language, t]);

    useEffect(() => {
        setBeauty(PRESETS[preset].beauty);
    }, [preset]);

    const isBeautyAvailable = useMemo(() => PRESETS[preset].beauty === 'on', [preset]);

    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        if (!subjectImage || !backgroundImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên cả ảnh chủ thể và ảnh nền.' : 'Please upload both subject and background images.');
            return;
        }
        setIsLoading(true);
        setResultImage(null);
        setError('');
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }

            const presetDirective = buildPresetDirective(preset, { beauty, aspect: aspectRatio });
            const finalPrompt = `
                ${presetDirective}\n\n
                [USER_PROMPT]
                instruction: Place the subject from the first image into the background of the second image. The final image should be a cohesive and high-quality artistic composition that blends the subject and background seamlessly according to the preset style.
                Positive: ${finalPositivePrompt}
                Negative: ${finalNegativePrompt}
                Output-Format: ${outputFormat.split('/')[1]}
            `;
            const parts = [subjectImage.apiPayload, backgroundImage.apiPayload, { text: finalPrompt }];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="design" />
                    <ImageUploader label={t('uploadSubject')} onImageUpload={setSubjectImage} />
                    <ImageUploader label={t('uploadBackground')} onImageUpload={setBackgroundImage} />
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('preset')}</label>
                        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {Object.entries(PRESETS).map(([key, value]) => (<option key={key} value={key}>{value.label[language as Language]}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {ASPECT_RATIOS.map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <label htmlFor="beautify-toggle-design" className="block text-sm font-bold text-light-text dark:text-dark-text">
                            {t('beautify')}
                            {!isBeautyAvailable && <span className="text-xs font-normal text-gray-500 ml-2">{t('beautifyHint')}</span>}
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                id="beautify-toggle-design"
                                checked={beauty === 'on'} 
                                onChange={(e) => setBeauty(e.target.checked ? 'on' : 'off')} 
                                className="sr-only peer" 
                                disabled={!isBeautyAvailable}
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-light-primary/50 dark:peer-focus:ring-dark-primary/50 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-light-primary dark:peer-checked:bg-dark-primary"></div>
                        </label>
                    </div>

                    <div>
                      <label htmlFor="positivePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                      <textarea id="positivePrompt" value={positivePrompt} onChange={(e) => setPositivePrompt(e.target.value)} placeholder={t('positivePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                    <div>
                      <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                      <textarea id="negativePrompt" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder={t('negativePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage && subjectImage ? <ImageComparator beforeSrc={subjectImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AICreative = ({ onBack }: {onBack: () => void}) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    const [positivePrompt, setPositivePrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState(() => t('creativeNegativeDefault'));
    const [preset, setPreset] = useState('art-fantasy');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    const [beauty, setBeauty] = useState<'on' | 'off'>(PRESETS[preset].beauty);
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    const prevLangRef = useRef(language);
    useEffect(() => {
        if (prevLangRef.current !== language) {
            setNegativePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['creativeNegativeDefault']
                    ? t('creativeNegativeDefault')
                    : currentPrompt
            );
            prevLangRef.current = language;
        }
    }, [language, t]);

    useEffect(() => {
        setBeauty(PRESETS[preset].beauty);
    }, [preset]);

    const isBeautyAvailable = useMemo(() => PRESETS[preset].beauty === 'on', [preset]);
    
    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        if (!positivePrompt.trim()) {
            setError(language === 'vi' ? 'Vui lòng nhập mô tả cho ảnh.' : 'Please enter an image prompt.');
            return;
        }
        setIsLoading(true);
        setResultImage(null);
        setError('');
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }
            
            const presetDirective = buildPresetDirective(preset, { beauty, aspect: 'auto' });
            const finalPrompt = `
                ${presetDirective}\n\n
                ${language === 'vi' ? VIETNAMESE_TEXT_INSTRUCTION : ''}
                [USER_PROMPT]
                Positive: ${finalPositivePrompt}
            `;
            const config = { aspectRatio, outputMimeType: outputFormat };
            
            const generatedImage = await callApi(() => generateImageFromText(ai, finalPrompt, finalNegativePrompt, config));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="creative" />
                    <div>
                        <label htmlFor="positivePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('imagePrompt')}</label>
                        <textarea id="positivePrompt" value={positivePrompt} onChange={(e) => setPositivePrompt(e.target.value)} placeholder={t('imagePromptPlaceholder')} rows={5} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('preset')}</label>
                        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {Object.entries(PRESETS).map(([key, value]) => (<option key={key} value={key}>{value.label[language as Language]}</option>))}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           {ASPECT_RATIOS.filter(r => r.value !== 'auto').map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <label htmlFor="beautify-toggle-creative" className="block text-sm font-bold text-light-text dark:text-dark-text">
                            {t('beautify')}
                             {!isBeautyAvailable && <span className="text-xs font-normal text-gray-500 ml-2">{t('beautifyHint')}</span>}
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="beautify-toggle-creative" checked={beauty === 'on'} onChange={(e) => setBeauty(e.target.checked ? 'on' : 'off')} className="sr-only peer" disabled={!isBeautyAvailable} />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-light-primary/50 dark:peer-focus:ring-dark-primary/50 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-light-primary dark:peer-checked:bg-dark-primary"></div>
                        </label>
                    </div>
                    <div>
                      <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                      <textarea id="negativePrompt" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder={t('negativePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage ? <img src={resultImage} alt="Generated result" className="object-contain max-h-full max-w-full rounded-lg" /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIArchitect = ({ onBack }: {onBack: () => void}) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    const [blueprintImage, setBlueprintImage] = useState<UploadedImage | null>(null);
    const [positivePrompt, setPositivePrompt] = useState(() => t('architectPositiveDefault'));
    const [negativePrompt, setNegativePrompt] = useState(() => t('architectNegativeDefault'));
    const [preset, setPreset] = useState('architecture-exterior');
    const [aspectRatio, setAspectRatio] = useState('auto');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    const prevLangRef = useRef(language);
    useEffect(() => {
        if (prevLangRef.current !== language) {
            setPositivePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['architectPositiveDefault']
                    ? t('architectPositiveDefault')
                    : currentPrompt
            );
            setNegativePrompt(currentPrompt => 
                currentPrompt === TRANSLATIONS[prevLangRef.current as Language]['architectNegativeDefault']
                    ? t('architectNegativeDefault')
                    : currentPrompt
            );
            prevLangRef.current = language;
        }
    }, [language, t]);
    
    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        if (!blueprintImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên bản thiết kế.' : 'Please upload a blueprint image.');
            return;
        }
        setIsLoading(true);
        setResultImage(null);
        setError('');
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }

            const presetDirective = buildPresetDirective(preset, { aspect: aspectRatio });
            const finalPrompt = `
                ${presetDirective}\n\n
                [USER_PROMPT]
                instruction: Transform the input architectural sketch/blueprint into a photorealistic render.
                Positive: ${finalPositivePrompt}
                Negative: ${finalNegativePrompt}
                Output-Format: ${outputFormat.split('/')[1]}
            `;
            const parts = [blueprintImage.apiPayload, { text: finalPrompt }];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="architect" />
                    <ImageUploader label={t('uploadBlueprint')} onImageUpload={setBlueprintImage} />
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('preset')}</label>
                        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {Object.entries(PRESETS).filter(([key]) => key.startsWith('architecture-')).map(([key, value]) => (<option key={key} value={key}>{value.label[language as Language]}</option>))}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           {ASPECT_RATIOS.map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>
                    <div>
                      <label htmlFor="positivePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                      <textarea id="positivePrompt" value={positivePrompt} onChange={(e) => setPositivePrompt(e.target.value)} placeholder={t('positivePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                    <div>
                      <label htmlFor="negativePrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                      <textarea id="negativePrompt" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder={t('negativePromptPlaceholder')} rows={3} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text" />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage && blueprintImage ? <ImageComparator beforeSrc={blueprintImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-cogs mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIVideoCreator = ({ onBack }: {onBack: () => void}) => {
    const { t, language } = useAppContext();
    const { ai, apiKey } = useApi();
    const [mode, setMode] = useState<VideoGenerationMode>('text');
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<UploadedImage | null>(null);
    const [contextImage, setContextImage] = useState<UploadedImage | null>(null);
    const [quality, setQuality] = useState<VideoQuality>('720p');
    const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
    const [isLoading, setIsLoading] = useState(false);
    const [resultVideo, setResultVideo] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [loadingMessage, setLoadingMessage] = useState('');

    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        setError('');
        if (!prompt.trim()) {
            setError(t('videoPromptRequired'));
            return;
        }
        if (mode === 'image' && (!image || !contextImage)) {
            setError(t('videoImageRequiredBoth'));
            return;
        }
        
        setIsLoading(true);
        setResultVideo(null);
        
        try {
            let finalPrompt = prompt;
            if (language === 'vi' && prompt.trim()) {
                finalPrompt = await callApi(() => translateText(ai, prompt, 'Vietnamese', 'English'));
            }

            let imageForVideoPayload: UploadedImage['apiPayload'] | null = null;
            if (mode === 'image' && image && contextImage) {
                setLoadingMessage(t('videoInProgressCompose').split('||')[0]);
                const composePrompt = {
                    text: `Take the character from the first image and place them realistically into the second image (the background/context). The final composed image should be a single, coherent scene.`,
                };
                const parts = [image.apiPayload, contextImage.apiPayload, composePrompt];
                const compositeImageDataUrl = await callApi(() => generateImage(ai, parts));
                
                const [header, base64Data] = compositeImageDataUrl.split(',');
                const mimeType = header.match(/:(.*?);/)![1];
                imageForVideoPayload = {
                    inlineData: { data: base64Data, mimeType },
                };
                
                setLoadingMessage(t('videoInProgressCompose').split('||')[1]);
            } else {
                 setLoadingMessage(t('generatingVideo'));
            }

            const videoUrl = await callApi(() => generateVideo(ai, apiKey, finalPrompt, imageForVideoPayload, quality, aspectRatio));
            setResultVideo(videoUrl);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };
    
    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline">
                <i className="fas fa-arrow-left mr-2"></i> {t('goBack')}
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('generationMode')}</label>
                        <div className="flex space-x-2 rounded-lg p-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border">
                            <button onClick={() => setMode('text')} className={`w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${mode === 'text' ? 'btn-primary text-white' : 'bg-transparent text-light-text dark:text-dark-text'}`}>
                                {t('textToVideo')}
                            </button>
                            <button onClick={() => setMode('image')} className={`w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${mode === 'image' ? 'btn-primary text-white' : 'bg-transparent text-light-text dark:text-dark-text'}`}>
                                {t('imageToVideo')}
                            </button>
                        </div>
                    </div>

                    {mode === 'image' && (
                        <>
                           <ImageUploader label={t('uploadCharacter')} onImageUpload={setImage} />
                           <ImageUploader label={t('uploadContext')} onImageUpload={setContextImage} />
                        </>
                    )}

                    <div>
                      <label htmlFor="videoPrompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('videoPrompt')}</label>
                      <textarea
                          id="videoPrompt"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder={t('videoPromptPlaceholder')}
                          rows={5}
                          className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                      />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('videoAspectRatio')}</label>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value as VideoAspectRatio)}
                            className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary"
                            aria-label={t('videoAspectRatio')}
                        >
                            <option value="16:9">{t('landscape')}</option>
                            <option value="9:16">{t('portrait')}</option>
                            <option value="1:1">{t('videoAspectSquare')}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('videoQuality')}</label>
                        <select
                            value={quality}
                            onChange={(e) => setQuality(e.target.value as VideoQuality)}
                            className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary"
                            aria-label={t('videoQuality')}
                        >
                            <option value="720p">{t('hd720')}</option>
                            <option value="1080p">{t('hd1080')}</option>
                        </select>
                    </div>

                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('videoResult')}</h3>
                         <div className="w-full aspect-video bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                            {isLoading ? (
                                <div className="text-center p-4">
                                    <Spinner />
                                    <p className="mt-4 font-semibold text-light-text dark:text-dark-text">{loadingMessage}</p>
                                    <p className="text-sm text-gray-500">{t('videoTakesTime')}</p>
                                </div>
                             ) : resultVideo ? (
                                 <video src={resultVideo} controls muted playsInline className="w-full h-full rounded-lg" />
                             ) : (
                                <p className="text-gray-500">{t('videoWillAppear')}</p>
                             )}
                         </div>
                         {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
                    </div>
                    {resultVideo && !isLoading && (
                        <a href={resultVideo} download="generated-video.mp4" className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-film mr-2"></i> {isLoading ? t('generatingVideo') : t('generateVideo')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIMagic = ({ onBack }: {onBack: () => void}) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [positivePrompt, setPositivePrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    
    const [doBeautify, setDoBeautify] = useState(false);
    const [doRestore, setDoRestore] = useState(false);
    const [preserveIdentity, setPreserveIdentity] = useState(true);

    const [aspectRatio, setAspectRatio] = useState('auto');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg');
    
    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        if (!sourceImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên ảnh gốc.' : 'Please upload the source image.');
            return;
        }

        const instructionParts = [];
        if (doBeautify) instructionParts.push("Beautify the subject: smooth skin, remove acne and blemishes, but keep it looking natural.");
        if (doRestore) instructionParts.push("Restore the photo: improve clarity, fix scratches, correct color fading, and reduce noise.");

        const hasMagicToggles = instructionParts.length > 0;
        const hasPrompts = positivePrompt.trim() !== '' || negativePrompt.trim() !== '';

        if (!hasMagicToggles && !hasPrompts) {
            setError(t('errorNoMagicFeature'));
            return;
        }
        
        setIsLoading(true);
        setResultImage(null);
        setError('');
        
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }
            
            let instruction = hasMagicToggles
                ? `Perform the following image editing operations: ${instructionParts.join(' ')}. `
                : 'Edit the image based on the user\'s prompts. ';

            if (preserveIdentity) {
                instruction += "IMPORTANT: You must strictly preserve the person's unique facial features and identity. Do not alter the fundamental shape of the eyes, nose, mouth, or jaw. The person in the output must be perfectly recognizable as the person in the input.";
            }

            const presetDirective = buildPresetDirective('product-commercial', { aspect: aspectRatio });
            
            const finalPrompt = `
                ${presetDirective}\n\n
                [USER_PROMPT]
                instruction: ${instruction}
                Positive: ${finalPositivePrompt}
                Negative: ${finalNegativePrompt}
                Output-Format: ${outputFormat.split('/')[1]}
            `;
            
            const parts = [sourceImage.apiPayload, { text: finalPrompt }];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="magic" />
                    <ImageUploader label={t('uploadSourceImage')} onImageUpload={setSourceImage} />
                    
                    <div>
                        <label htmlFor="magic-positive-prompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                        <textarea
                            id="magic-positive-prompt"
                            value={positivePrompt}
                            onChange={(e) => setPositivePrompt(e.target.value)}
                            placeholder={t('positivePromptPlaceholder')}
                            rows={3}
                            className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                        />
                    </div>
                    <div>
                        <label htmlFor="magic-negative-prompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                        <textarea
                            id="magic-negative-prompt"
                            value={negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            placeholder={t('negativePromptPlaceholder')}
                            rows={3}
                            className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                        />
                    </div>

                    <div className="space-y-4">
                        <ToggleSwitch
                            id="magic-beautify"
                            label={t('magicBeautify')}
                            description={t('magicBeautifyDesc')}
                            checked={doBeautify}
                            onChange={(e) => setDoBeautify(e.target.checked)}
                            disabled={isLoading}
                        />
                         <ToggleSwitch
                            id="magic-restore"
                            label={t('magicRestore')}
                            description={t('magicRestoreDesc')}
                            checked={doRestore}
                            onChange={(e) => setDoRestore(e.target.checked)}
                            disabled={isLoading}
                        />
                        <hr className="border-light-border dark:border-dark-border" />
                         <ToggleSwitch
                            id="magic-preserve"
                            label={t('preserveIdentity')}
                            description={t('preserveIdentityDesc')}
                            checked={preserveIdentity}
                            onChange={(e) => setPreserveIdentity(e.target.checked)}
                            disabled={isLoading}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           {ASPECT_RATIOS.map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/png">PNG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage && sourceImage ? <ImageComparator beforeSrc={sourceImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-wand-magic-sparkles mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const UpscaleAI = ({ onBack }: {onBack: () => void}) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [positivePrompt, setPositivePrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [upscaleLevel, setUpscaleLevel] = useState<'2x' | '4x' | '8x'>('4x');
    const [skinStyle, setSkinStyle] = useState('High_Fidelity_Realism');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/png');

    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        if (!sourceImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên ảnh gốc.' : 'Please upload the source image.');
            return;
        }
        
        setIsLoading(true);
        setResultImage(null);
        setError('');
        
        try {
            let finalPositivePrompt = positivePrompt;
            let finalNegativePrompt = negativePrompt;

            if (language === 'vi') {
                if (positivePrompt.trim()) finalPositivePrompt = await callApi(() => translateText(ai, positivePrompt, 'Vietnamese', 'English'));
                if (negativePrompt.trim()) finalNegativePrompt = await callApi(() => translateText(ai, negativePrompt, 'Vietnamese', 'English'));
            }

            const { width, height } = await getImageDimensions(sourceImage.dataUrl);
            const upscaleMultiplier = parseInt(upscaleLevel.replace('x', ''), 10);
            const targetWidth = width * upscaleMultiplier;
            const targetHeight = height * upscaleMultiplier;

            const pipelineConfig: {
                pipeline_name: string;
                preserve_face: boolean;
                avoid_plastic_skin: boolean;
                target_resolution: string;
                cinematic_tone: boolean;
                steps: { stage: number; scale: string; purpose: string }[];
            } = {
                pipeline_name: "MultiStageSuperResolution",
                preserve_face: true,
                avoid_plastic_skin: true,
                target_resolution: `${targetWidth}x${targetHeight}px`,
                cinematic_tone: true,
                steps: []
            };
    
            if (upscaleLevel === '2x') {
                pipelineConfig.steps.push({ stage: 1, scale: "2x", purpose: "Upscale 2x. Recover soft details and gradients. Finalize sharp output." });
            } else if (upscaleLevel === '4x') {
                pipelineConfig.steps.push({ stage: 1, scale: "2x", purpose: "Recover soft details and gradients." });
                pipelineConfig.steps.push({ stage: 2, scale: "4x", purpose: "Enhance micro-textures (peach fuzz, fabric, etc.). Finalize sharp output." });
            } else if (upscaleLevel === '8x') {
                pipelineConfig.steps.push({ stage: 1, scale: "2x", purpose: "Recover soft details and gradients." });
                pipelineConfig.steps.push({ stage: 2, scale: "4x", purpose: "Enhance micro-textures (peach fuzz, fabric, etc.)." });
                pipelineConfig.steps.push({ stage: 3, scale: "8x", purpose: "Finalize ultra-sharp 8K-quality output." });
            }
            
            const selectedSkinRender = UPSCALE_FORMULA.skin_library[skinStyle as keyof typeof UPSCALE_FORMULA.skin_library].skin_render;

            const finalPrompt = `
You are a professional image processing AI. Your task is to perform a high-quality, multi-stage super-resolution upscale on the provided image.

**CRITICAL INSTRUCTION: FOLLOW THE PIPELINE**
You MUST follow the exact upscaling pipeline defined in the JSON configuration below. The most important rule is to produce an output image with the exact 'target_resolution'.

**JSON UPSCALE CONFIGURATION:**
\`\`\`json
${JSON.stringify(pipelineConfig, null, 2)}
\`\`\`

**ADDITIONAL INSTRUCTIONS:**
1.  **GENERATE NEW DETAIL:** As you upscale, intelligently generate new, photorealistic details. The result must be sharp, clear, and high-fidelity. Do not just resize and blur.
2.  **PRESERVE IDENTITY:** Perfectly maintain the subject's facial features and identity. The person in the output must be instantly recognizable.
3.  **PRESERVE COMPOSITION:** Do not change the original composition, colors, or lighting.
4.  **SKIN RENDERING:** For human subjects, render skin with the following style: "${selectedSkinRender}".

**USER PROMPTS:**
- Positive: ${finalPositivePrompt || 'None'}
- Negative (things to avoid): Returning an image with the original dimensions. Blurry results. Changes to subject's identity. ${finalNegativePrompt || ''}

Execute the pipeline and return only the final, upscaled image.
`;
            
            const parts = [sourceImage.apiPayload, { text: finalPrompt }];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="upscale" />
                    <ImageUploader label={t('uploadSourceImage')} onImageUpload={setSourceImage} />
                    
                    <div>
                        <label htmlFor="upscale-positive-prompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('positivePrompt')}</label>
                        <textarea
                            id="upscale-positive-prompt"
                            value={positivePrompt}
                            onChange={(e) => setPositivePrompt(e.target.value)}
                            placeholder={t('positivePromptPlaceholder')}
                            rows={3}
                            className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                        />
                    </div>
                    <div>
                        <label htmlFor="upscale-negative-prompt" className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('negativePrompt')}</label>
                        <textarea
                            id="upscale-negative-prompt"
                            value={negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            placeholder={t('negativePromptPlaceholder')}
                            rows={3}
                            className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('upscaleLevelLabel')}</label>
                        <div className="flex space-x-2 rounded-lg p-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border">
                            {(['2x', '4x', '8x'] as const).map((level) => (
                                <button
                                    key={level}
                                    onClick={() => setUpscaleLevel(level)}
                                    className={`w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
                                        upscaleLevel === level
                                        ? 'btn-primary text-white'
                                        : 'bg-transparent text-light-text dark:text-dark-text hover:bg-light-surface dark:hover:bg-dark-surface'
                                    }`}
                                >
                                    {level.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('upscaleSkinStyleLabel')}</label>
                        <select value={skinStyle} onChange={(e) => setSkinStyle(e.target.value)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                            {Object.keys(UPSCALE_FORMULA.skin_library).map(key => (
                                <option key={key} value={key}>
                                    {t(`skinStyle_${key}` as StringTranslationKeys)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('outputFormat')}</label>
                        <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                           <option value="image/png">PNG</option>
                           <option value="image/jpeg">JPEG</option>
                           <option value="image/webp">WEBP</option>
                        </select>
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border">
                             {isLoading ? <Spinner /> : resultImage && sourceImage ? <ImageComparator beforeSrc={sourceImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-search-plus mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIBackground = ({ onBack }: {onBack: () => void}) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        if (!sourceImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên một hình ảnh.' : 'Please upload an image.');
            return;
        }
        
        setIsLoading(true);
        setResultImage(null);
        setError('');
        
        try {
            const finalPrompt = `
                **CRITICAL INSTRUCTION: BACKGROUND REMOVAL**

                Your ONLY task is to perfectly remove the background from the input image.

                **RULES:**
                1.  **IDENTIFY SUBJECT:** Accurately identify the main subject(s) of the image.
                2.  **PRECISE MASKING:** Create a clean, sharp, and precise mask around the subject(s).
                3.  **TRANSPARENT OUTPUT:** The output image MUST have a transparent background. The format should be PNG.
                4.  **PRESERVE SUBJECT:** You must NOT alter the subject in any way. Preserve all original details, textures, and colors of the subject.
                5.  **NO ADDITIONS:** Do not add any new background, shadows, outlines, or any other elements.

                The result should be only the original subject on a transparent canvas.
            `;
            
            const parts = [sourceImage.apiPayload, { text: finalPrompt }];
            const generatedImage = await callApi(() => generateImage(ai, parts));
            setResultImage(generatedImage);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <ToolInfo toolKey="background" />
                    <ImageUploader label={t('uploadImage')} onImageUpload={setSourceImage} />
                </div>
                <div className="space-y-6">
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                         <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{t('result')}</h3>
                         <div className="w-full h-96 bg-light-bg dark:bg-dark-bg rounded-lg flex items-center justify-center border border-light-border dark:border-dark-border checkerboard-bg">
                             {isLoading ? <Spinner /> : resultImage && sourceImage ? <ImageComparator beforeSrc={sourceImage.dataUrl} afterSrc={resultImage} /> : <p className="text-gray-500">{t('preview')}</p>}
                         </div>
                         {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
                    </div>
                    {resultImage && !isLoading && (
                        <a href={resultImage} download={getDownloadFilename(resultImage)} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                            <i className="fas fa-download mr-2"></i> {t('download')}
                        </a>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading || !sourceImage} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-eraser mr-2"></i> {isLoading ? t('generating') : t('generate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIComicStyle = ({ onBack }: { onBack: () => void }) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<{ style: string, imageUrl: string }[]>([]);
    const [error, setError] = useState('');

    const comicStyles = {
        'Marvel': 'A dynamic, high-contrast comic book style reminiscent of modern Marvel comics. Use bold inks, dramatic lighting, and a cinematic feel.',
        'Anime': 'A vibrant, clean 90s anime style. Use bright colors, cel shading, distinct line art, and expressive, large eyes.',
        'Disney': 'A soft, friendly, and painterly style similar to modern Disney animated films. Use smooth gradients, warm lighting, and a gentle, storybook quality.',
        'Manga': 'A classic black and white manga style. Use screentones for shading, dynamic paneling effects, and expressive ink work. Focus on dramatic lines and emotional depth.',
    };

    const handleSubmit = async () => {
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }
        if (!sourceImage) {
            setError(language === 'vi' ? 'Vui lòng tải lên một hình ảnh.' : 'Please upload an image.');
            return;
        }

        setIsLoading(true);
        setResults([]);
        setError('');

        try {
            const generationPromises = Object.entries(comicStyles).map(async ([styleName, stylePrompt]) => {
                const finalPrompt = `
                    [TASK] Transform the user's photo into a comic book art style.

                    [IDENTITY PRESERVATION]
                    **CRITICAL INSTRUCTION: ABSOLUTE LIKENESS REQUIRED**
                    You MUST strictly preserve the core facial features and identity of the person in the photo. The character in the output must be perfectly recognizable as the same person, just rendered in the new art style. Do NOT create a different person.

                    [STYLE INSTRUCTION]
                    Render the image in the following style: **${styleName}**.
                    - **Details:** ${stylePrompt}
                    - The final image should be a high-quality, artistic illustration.

                    [OUTPUT] Generate a single image based on these instructions.
                `;
                const parts = [sourceImage.apiPayload, { text: finalPrompt }];
                const imageUrl = await callApi(() => generateImage(ai, parts));
                return { style: styleName, imageUrl };
            });

            const settledResults = await Promise.allSettled(generationPromises);
            
            const successfulResults = settledResults
                .filter(res => res.status === 'fulfilled')
                .map(res => (res as PromiseFulfilledResult<{ style: string, imageUrl: string }>).value);
            
            setResults(successfulResults);
            
            const failedCount = settledResults.filter(res => res.status === 'rejected').length;
            if (failedCount > 0) {
                setError(`${failedCount} style(s) failed to generate.`);
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline"><i className="fas fa-arrow-left mr-2"></i> {t('goBack')}</button>
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-8">
                    <h2 className="text-4xl md:text-5xl font-extrabold mb-2 bg-gradient-to-r from-red-500 via-yellow-500 to-orange-500 bg-clip-text text-transparent">
                        {t('comicStudioTitle')}
                    </h2>
                    <p className="text-lg text-gray-500 dark:text-gray-300">{t('comicStudioDesc')}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-6 bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                        <ImageUploader label={t('uploadImage')} onImageUpload={setSourceImage} />
                        <button onClick={handleSubmit} disabled={isLoading || !sourceImage} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                            <i className="fas fa-paint-brush mr-2"></i> {isLoading ? t('generating') : t('generate')}
                        </button>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border min-h-[400px]">
                            <h3 className="text-xl font-bold mb-4 text-light-text dark:text-dark-text text-center">{t('result')}</h3>
                            {isLoading && <Spinner />}
                            {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
                            {!isLoading && results.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {results.map(res => (
                                        <div key={res.style} className="bg-light-bg dark:bg-dark-bg p-3 rounded-lg border border-light-border dark:border-dark-border">
                                            <h4 className="font-bold text-center mb-2">{res.style}</h4>
                                            <img src={res.imageUrl} alt={res.style} className="w-full h-auto rounded-md shadow-sm" />
                                            <a href={res.imageUrl} download={`comic-style-${res.style}.png`} className="w-full mt-2 btn-secondary text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center">
                                                <i className="fas fa-download mr-2"></i> {t('download')}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!isLoading && results.length === 0 && <p className="text-gray-500 text-center">{t('preview')}</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- NEW BATCH TOOL: Whisk Auto Studio ---
type BatchResult = {
    prompt: string;
    imageUrl: string | null;
    error: string | null;
}

const WhiskAutoStudio = ({ onBack }: { onBack: () => void }) => {
    const { t, language } = useAppContext();
    const { ai } = useApi();
    
    const [characterAsset, setCharacterAsset] = useState<UploadedImage | null>(null);
    const [backgroundAsset, setBackgroundAsset] = useState<UploadedImage | null>(null);
    const [prompts, setPrompts] = useState('');
    const [aspectRatio, setAspectRatio] = useState('16:9');
    
    const [isLoading, setIsLoading] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState<BatchResult[]>([]);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    
    const isRunningRef = useRef(false);

    const handleStop = () => {
        setIsStopping(true);
        isRunningRef.current = false;
    };

    const handleSubmit = async () => {
        const promptList = prompts.split('\n').filter(p => p.trim() !== '');

        if (!characterAsset || !backgroundAsset) {
            setError(t('batchNoAssets'));
            return;
        }
        if (promptList.length === 0) {
            setError(t('batchNoPrompts'));
            return;
        }
        if (!ai) {
            setError(t('serviceUnavailable'));
            return;
        }

        setIsLoading(true);
        setIsStopping(false);
        setError('');
        setResults([]);
        setProgress({ current: 0, total: promptList.length });
        isRunningRef.current = true;

        for (let i = 0; i < promptList.length; i++) {
            if (!isRunningRef.current) break;
            
            const currentPrompt = promptList[i];
            setProgress({ current: i + 1, total: promptList.length });
            
            try {
                let finalPromptText = currentPrompt;
                if (language === 'vi' && currentPrompt.trim()) {
                    finalPromptText = await callApi(() => translateText(ai, currentPrompt, 'Vietnamese', 'English'));
                }
                
                const presetDirective = buildPresetDirective('special-wedding', { aspect: aspectRatio });
                const finalPrompt = `
                    ${presetDirective}\n\n
                    [USER_PROMPT]
                    instruction: Combine the character(s) from the first image with the scene from the second image, guided by the text prompt. Create a coherent, realistic, and high-quality photograph.
                    Positive: ${finalPromptText}
                    Negative: blurry, deformed, bad anatomy, ugly
                    Output-Format: jpeg
                `;
                
                const parts = [characterAsset.apiPayload, backgroundAsset.apiPayload, { text: finalPrompt }];
                const imageUrl = await callApi(() => generateImage(ai, parts));
                setResults(prev => [...prev, { prompt: currentPrompt, imageUrl, error: null }]);

            } catch (err: any) {
                console.error(`Failed to generate for prompt: "${currentPrompt}"`, err);
                setResults(prev => [...prev, { prompt: currentPrompt, imageUrl: null, error: err.message || 'Generation failed' }]);
            }
        }
        
        setIsLoading(false);
        setIsStopping(false);
        isRunningRef.current = false;
    };
    

    return (
        <div className="p-4 md:p-8 animate-fade-in">
            <button onClick={onBack} className="mb-6 flex items-center text-light-text dark:text-dark-text hover:underline">
                <i className="fas fa-arrow-left mr-2"></i> {t('goBack')}
            </button>

            <div className="max-w-3xl mx-auto space-y-6">
                 <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border space-y-4">
                    <h3 className="text-xl font-bold">{t('batchProject')}</h3>
                    <ImageUploader label={t('batchCharacter')} onImageUpload={setCharacterAsset} />
                    <ImageUploader label={t('batchBackground')} onImageUpload={setBackgroundAsset} />
                </div>
                
                <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <label htmlFor="batch-prompts" className="block text-sm font-bold mb-2">{t('batchPrompts')}</label>
                    <textarea
                        id="batch-prompts"
                        value={prompts}
                        onChange={e => setPrompts(e.target.value)}
                        placeholder={t('batchPromptsPlaceholder')}
                        rows={5}
                        className="w-full p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text"
                        disabled={isLoading}
                    />
                </div>
                
                <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                    <label className="block text-sm font-bold mb-2 text-light-text dark:text-dark-text">{t('aspectRatio')}</label>
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isLoading} className="w-full p-3 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-light-text dark:text-dark-text">
                       {ASPECT_RATIOS.filter(r => r.value !== 'auto').map(ratio => (<option key={ratio.value} value={ratio.value}>{ratio.label[language as Language]}</option>))}
                    </select>
                </div>
                
                 {isLoading && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div className="bg-light-primary dark:bg-dark-primary h-2.5 rounded-full" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}></div>
                    </div>
                 )}
                 <p className="text-center text-sm font-semibold h-5">
                    {isLoading ? `${t('batchGenerating')} ${progress.current} / ${progress.total}` : (results.length > 0 && progress.current === progress.total ? `${t('batchCompleted')} ${results.length} / ${progress.total}` : '')}
                 </p>
                
                <div className="flex gap-4">
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full btn-primary text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fas fa-play mr-2"></i> {isLoading ? t('batchGenerating') : t('batchStart')}
                    </button>
                    <button onClick={handleStop} disabled={!isLoading || isStopping} className="w-full btn-danger text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                       <i className="fas fa-stop mr-2"></i> {isStopping ? t('batchStopped') : t('batchStop')}
                    </button>
                </div>
                {error && <p className="text-red-500 text-center font-semibold">{error}</p>}
                
                { (results.length > 0 || isLoading) && 
                    <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-lg shadow-md border border-light-border dark:border-dark-border">
                        <h3 className="text-xl font-bold mb-4">{t('batchResults')}</h3>
                        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
                            {results.map((result, index) => (
                                <div key={index} className="p-4 bg-light-bg dark:bg-dark-bg rounded-lg border border-light-border dark:border-dark-border">
                                    <p className="font-semibold text-sm mb-2">#{index + 1}: {result.prompt}</p>
                                    {result.imageUrl && (
                                        <div>
                                            <img src={result.imageUrl} alt={`Result for ${result.prompt}`} className="rounded-md w-full" />
                                            <a href={result.imageUrl} download={`result-${index+1}.png`} className="w-full mt-2 btn-secondary text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center">
                                                <i className="fas fa-download mr-2"></i> {t('download')}
                                            </a>
                                        </div>
                                    )}
                                    {result.error && <p className="text-red-500 text-sm mt-2">Error: {result.error}</p>}
                                </div>
                            ))}
                            {isLoading && results.length < progress.total && <div className="py-8"><Spinner /></div>}
                        </div>
                    </div>
                }
            </div>
        </div>
    );
}

const Footer = () => {
  return (
    <footer className="bg-light-surface dark:bg-dark-surface p-6 text-center border-t border-light-border dark:border-dark-border">
      <div className="mb-4 space-y-2">
        <p className="font-bold text-light-text dark:text-dark-text uppercase">
          Hãy mời tôi 1 ly cafe nếu bạn thấy hữu ích
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          MB BANK : 0917939111
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Tham gia nhóm để được hỗ trợ miễn phí:
          </p>
          <a
            href="https://zalo.me/g/xxgxqm429"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1 text-sm font-bold text-white rounded-md btn-primary"
            aria-label="Tham gia nhóm Zalo"
          >
            THAM GIA
          </a>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        ©2025 Bản quyền thuộc về Dương Tiến Dũng 📱0917 939 111
      </p>
    </footer>
  );
};


// --- Main App Component ---
const App = () => {
  const [page, setPage] = useState<Page>('home');
  const [theme, setTheme] = useState<Theme>('dark');
  const [language, setLanguage] = useState<Language>('vi');

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(storedTheme as Theme);
  }, []);

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  // Fix: Update 't' function to be correctly typed with an overloaded signature.
  const t = useCallback(
    ((key: string): string | string[] => {
      const typedKey = key as keyof TranslationsType;
      return TRANSLATIONS[language]?.[typedKey] || TRANSLATIONS['en'][typedKey] || key;
    }) as IAppContext['t'],
    [language]
  );
  
  const handleNavigate = (newPage: Page) => {
      setPage(newPage);
  };
  
  const contextValue = useMemo(() => ({
    theme,
    setTheme,
    language,
    setLanguage,
    t,
  }), [theme, language, t]);

  const renderPage = () => {
    switch (page) {
      case 'pose':
        return <PoseStudio onBack={() => setPage('home')} />;
      case 'prop':
        return <PropFusion onBack={() => setPage('home')} />;
      case 'design':
        return <AIDesign onBack={() => setPage('home')} />;
      case 'creative':
        return <AICreative onBack={() => setPage('home')} />;
      case 'stylist':
        return <AIStylist onBack={() => setPage('home')} />;
      case 'architect':
        return <AIArchitect onBack={() => setPage('home')} />;
      case 'video':
        return <AIVideoCreator onBack={() => setPage('home')} />;
      case 'magic':
        return <AIMagic onBack={() => setPage('home')} />;
      case 'upscale':
        return <UpscaleAI onBack={() => setPage('home')} />;
      case 'background':
        return <AIBackground onBack={() => setPage('home')} />;
      case 'trendko':
        return <AITrendMaker onBack={() => setPage('home')} />;
      case 'batch':
        return <WhiskAutoStudio onBack={() => setPage('home')} />;
      case 'lookbook':
        return <LookbookStudio onBack={() => setPage('home')} />;
      case 'placement':
        return <ProductPlacement onBack={() => setPage('home')} />;
      case 'comic':
        return <AIComicStyle onBack={() => setPage('home')} />;
      case 'home':
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };
  
  return (
    <AppContext.Provider value={contextValue}>
      <div className={`min-h-screen flex flex-col bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text transition-colors duration-300`}>
        <Header />
        <main className="flex-grow">{renderPage()}</main>
        <Footer />
      </div>
    </AppContext.Provider>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ApiProvider>
        <App />
    </ApiProvider>
  );
}