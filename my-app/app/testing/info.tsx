import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function PatientForm() {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-center">ใบสั่งยา</CardTitle>
        </CardHeader>

        <CardContent className="grid grid-cols-3 gap-4">
            <Label>รพ.เภสัชหัวเฉียว</Label>
            <Label>เวชระเบียนผู้ป่วยนอก</Label>
            <Label>HN 00100</Label>
            <Label>4-210 โภชนาการ สมุทรปราการ Tel. xxxxx</Label>
        </CardContent>
      </Card>

      <Card className="pt-4">
        <CardContent className="grid grid-cols-3 gap-4">
            <Label>ชื่อ   นาย ชาติ ตระการตา</Label>
            <Label>อายุ  30 ปี 4 เดือน</Label>
            <Label>วันเกิด 1 มกราคม 2538</Label>
            <Label>สิทธิการรักษา   ประกันสังคม</Label>
            <Label>CID</Label>
            <Label>วันที่เข้ารับบริการ    เวลา    </Label>
            <Label>ที่อยู่  11</Label>
            <Label></Label>
            <Label>เบอร์โทรผู้ป่วย  -</Label>
        </CardContent>
      </Card>

      <Card className="pt-4">
        <CardContent className="grid grid-cols-3 gap-4">
            <Label>BP 120/80 mmHg PR 70/min</Label>
            <div>
                <Checkbox id="terms" />
                <Label> ให้นมบุตร</Label>
            </div>
            <div>
                <Checkbox id="terms" />
                <Label> ตั้งครรภ์</Label>
            </div>
            <Label>RP 20 /min Temp 36.8 c</Label>
            <Label></Label>
            <Label>แพ้ยา/อาหาร   ปฏิเสธแพ้ยา</Label>
            <Label>Wt 60 kg Ht 165 cm</Label>
            <Label></Label>
            <Label>โรคประจำตัว    -</Label>
        </CardContent>
      </Card>
      
      <Card className="pt-4">
        <CardContent className="grid grid-cols-3 gap-4">
            <Label>CC: ปวดหูข้างที่ข้างซ้าย รู้สึกแน่นๆ ภายในหู</Label>
            <Label></Label>
            <Label className="font-bold">Treatment</Label>
            <Label></Label>
            <Label></Label>
            <Label className="font-bold">-    Ibuprofen 400 mg 1x3 pc #10</Label>
            <Label></Label>
            <Label></Label>
            <Label className="font-bold">-    Amoxycillin 500 mg 1x3 pc #30</Label>
            <Label>PE: Erythema and bulging of the tympanic membrance</Label>
            <Label></Label>
            <Label className="font-bold">-    Dexoph® ear drops 3 drop a.s. TID #1</Label>
            <Label></Label>
            <Label></Label>
        </CardContent>
      </Card>

    </div>
  );
}