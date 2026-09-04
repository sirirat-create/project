export const STATUS_LABEL = {
  INTAKE: 'คลังรับแล้ว รอลงทะเบียน',
  REGISTERED: 'ลงทะเบียนแล้ว รอส่งบัญชี',
  IN_TRANSIT: 'ส่งบัญชีแล้ว รอบัญชีรับ',
  ACCEPTED: 'บัญชีรับแล้ว',
};

export const STATUS_ORDER = ['INTAKE', 'REGISTERED', 'IN_TRANSIT', 'ACCEPTED'];

export const ROLE_LABEL = {
  WAREHOUSE: 'ทีมคลังสินค้า',
  GM: 'ทีม GM',
  ACCOUNTING: 'ทีมบัญชี',
  ADMIN: 'ผู้ดูแลระบบ',
};

// วันที่-เวลาแบบไทย ใช้ในไฟล์ Excel และข้อความแจ้งเตือน
export function formatThaiDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
