"""Build compact local labels and country containment from Natural Earth admin-0 GeoJSON."""
import argparse, json, math
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('--tolerance',type=float,default=.08)
a=p.parse_args();root=Path(__file__).resolve().parent.parent

def distance(point,start,end):
    dx,dy=end[0]-start[0],end[1]-start[1]
    t=max(0,min(1,((point[0]-start[0])*dx+(point[1]-start[1])*dy)/(dx*dx+dy*dy))) if dx or dy else 0
    return math.hypot(point[0]-start[0]-t*dx,point[1]-start[1]-t*dy)
def simplify(points):
    if len(points)<=3:return points
    best,index=max((distance(point,points[0],points[-1]),i) for i,point in enumerate(points[1:-1],1))
    if best<=a.tolerance:return [points[0],points[-1]]
    return simplify(points[:index+1])[:-1]+simplify(points[index:])
regions=[];labels=[]
for f in json.loads(Path(a.source).read_text())['features']:
    props=f['properties'];name=props['NAME_EN']
    name={"People's Republic of China":'China','United States of America':'United States'}.get(name,name)
    g=f['geometry'];polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
    converted=[]
    for polygon in polys:
        rings=[]
        for ring in polygon:
            reduced=simplify(ring)
            if len(reduced)<4:reduced=ring
            rings.append([[round(x,3),round(y,3)] for x,y in reduced])
        converted.append(rings)
    regions.append(dict(name=name,polygons=converted))
    labels.append([name,props['LABEL_Y'],props['LABEL_X'],'country',props['LABELRANK']])
for filename,data in [('countries.json',labels),('country-regions.json',regions)]:
    out=root/'public'/'data'/'artist-globe'/filename
    out.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    print(filename,len(data),'records',out.stat().st_size,'bytes')
