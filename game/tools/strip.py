import sys,glob
from PIL import Image
out, pat = sys.argv[1], sys.argv[2]
fs = sorted(glob.glob(pat)); ims=[Image.open(f) for f in fs]; w,h=ims[0].size; cols=min(8,len(ims)); rows=(len(ims)+cols-1)//cols
g=Image.new('RGB',(w*cols,h*rows))
for i,im in enumerate(ims): g.paste(im,((i%cols)*w,(i//cols)*h))
g.save(out)
