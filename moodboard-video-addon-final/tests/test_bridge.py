import importlib.util
import tempfile
import unittest
from pathlib import Path
from subprocess import run

BRIDGE_PATH = Path(__file__).resolve().parents[1] / 'mac-bridge' / 'bridge.py'
spec = importlib.util.spec_from_file_location('video_bridge', BRIDGE_PATH)
bridge = importlib.util.module_from_spec(spec)
import sys
sys.modules[spec.name] = bridge
spec.loader.exec_module(bridge)

class VideoPipelineTests(unittest.TestCase):
    def test_pin_url_validation(self):
        self.assertEqual(bridge.canonical_pinterest_url('https://in.pinterest.com/pin/474355773273105661/?foo=1'),
                         ('474355773273105661', 'https://in.pinterest.com/pin/474355773273105661/'))
        for value in ('http://in.pinterest.com/pin/123/', 'https://evil.com/pin/123/',
                      'https://www.pinterest.com/board/foo/', 'https://pinterest.com.evil.com/pin/1/',
                      'https://www.pinterest.com/pin/1@127.0.0.1/', 'file:///pin/1'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                bridge.canonical_pinterest_url(value)

    def test_full_duration_and_size(self):
        if not bridge.shutil.which('ffmpeg') or not bridge.shutil.which('ffprobe'):
            self.skipTest('ffmpeg/ffprobe missing')
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp)
            source = temp / 'sample.mp4'
            run(['ffmpeg','-hide_banner','-loglevel','error','-y',
                 '-f','lavfi','-i','testsrc2=size=640x360:rate=24:duration=3',
                 '-c:v','libx264','-pix_fmt','yuv420p',str(source)], check=True)
            original_w, original_h, original_duration = bridge.video_metadata(source)
            self.assertAlmostEqual(original_duration, 3, delta=.1)
            gif, info = bridge.convert_video_to_gif(source,temp)
            self.assertTrue(gif.exists())
            self.assertLess(gif.stat().st_size,bridge.MAX_OUTPUT_BYTES)
            self.assertLess(info['width']*info['height']*info['frames'],bridge.MAX_FRAMES_AREA)
            self.assertGreater(info['frames'], 20)
            self.assertEqual(gif.read_bytes()[:6], b'GIF89a')
            self.assertEqual(info['loop'], 0)
            self.assertAlmostEqual(info['gifSeconds'], 3, delta=.5)
            self.assertIn(b'NETSCAPE2.0\x03\x01\x00\x00', gif.read_bytes()[:5000])
            self.assertLess(gif.stat().st_size, 20_000_000)

    def test_progress_details_from_conversion(self):
        if not bridge.shutil.which('ffmpeg') or not bridge.shutil.which('ffprobe'):
            self.skipTest('ffmpeg/ffprobe missing')
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp)
            source = temp / 'sample.mp4'
            run(['ffmpeg','-hide_banner','-loglevel','error','-y',
                 '-f','lavfi','-i','testsrc2=size=320x180:rate=12:duration=2',
                 '-c:v','libx264','-pix_fmt','yuv420p',str(source)], check=True)
            attempts=[]
            _, details = bridge.convert_video_to_gif(source,temp,
                lambda *args: attempts.append(args))
            self.assertTrue(attempts)
            self.assertEqual(attempts[0][0],1)
            self.assertEqual(attempts[0][1],len(bridge.PRESETS))
            self.assertEqual(details['loop'], 0)

    def test_title_and_filename(self):
        title = bridge.best_source_title({'title': 'Ocean waves at sunrise – Motion Study'}, '12345')
        self.assertEqual(title, 'Ocean waves at sunrise – Motion Study')
        filename = bridge.presentation_filename(title, '12345')
        self.assertEqual(filename, 'Ocean waves at sunrise – Motion Study - 12345.gif')
        self.assertEqual(bridge.best_source_title({}, '12345'), 'Pinterest video 12345')
        self.assertNotIn('/', bridge.presentation_filename('../unauthorized / video', '12345'))

if __name__ == '__main__':
    unittest.main()
