import sys
from PIL import Image
out, *ims = sys.argv[1:]
ims=[Image.open(f) for f in ims]; w,h=ims[0].size; cols=2; rows=(len(ims)+1)//2
g=Image.new('RGB',(w//2*cols,h//2*rows))
for i,im in enumerate(ims): g.paste(im.resize((w//2,h//2)),((i%cols)*(w//2),(i//cols)*(h//2)))
g.save(out)
