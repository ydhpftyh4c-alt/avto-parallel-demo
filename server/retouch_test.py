import unittest
from PIL import Image
from retouch import build_mask


class MaskTests(unittest.TestCase):
    def test_generic_car_text_and_plates_are_not_watermarks(self):
        rows = [[[[10, 10], [60, 10], [60, 20], [10, 20]], "BMW X5", .99],
                [[[20, 40], [60, 40], [60, 50], [20, 50]], "A123BC", .98]]
        mask, found, coverage = build_mask(Image.new("RGB", (100, 100)), "lotte", [], lambda _: (rows, None))
        self.assertEqual(found, [])
        self.assertEqual(coverage, 0)

    def test_known_supplier_and_manual_mask(self):
        rows = [[[[10, 10], [60, 10], [60, 20], [10, 20]], "LOTTE AUTO GLOBAL", .98]]
        _, found, coverage = build_mask(Image.new("RGB", (100, 100)), "lotte", [], lambda _: (rows, None))
        self.assertEqual(len(found), 1)
        self.assertGreater(coverage, 0)
        mask, _, _ = build_mask(Image.new("RGB", (100, 100)), "agency", [[.1, .2, .2, .1]])
        self.assertEqual(mask.getpixel((15, 25)), 255)
        self.assertEqual(mask.getpixel((0, 0)), 0)

    def test_lotte_emblem_requires_known_source_and_central_wordmark(self):
        rows = [[[[404, 374], [727, 374], [727, 414], [404, 414]], "ALOGLOBAL", .9]]
        image = Image.new("RGB", (960, 686))
        _, found, _ = build_mask(image, "lotte", [], lambda _: (rows, None))
        self.assertEqual(found, [])
        mask, found, _ = build_mask(image, "lotte", [], lambda _: (rows, None), template="lotte-wm224")
        self.assertEqual(found[0]["template"], "lotte-wm224")
        self.assertEqual(mask.getpixel((480, 315)), 255)
        self.assertEqual(mask.getpixel((200, 500)), 0)


if __name__ == "__main__":
    unittest.main()
