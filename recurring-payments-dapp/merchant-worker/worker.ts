import { ethers } from "ethers";
import * as dotenv from "dotenv";
import cron from "node-cron";

dotenv.config();

// 1. إعداد الاتصال بالبلوكشين
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.MERCHANT_PRIVATE_KEY!, provider);

// 2. إعداد العقد الذكي (ABI مبسط للدوال والأحداث التي نحتاجها)
const contractAddress = process.env.CONTRACT_ADDRESS!;
const merchantAddress = process.env.MERCHANT_ADDRESS!;

const abi = [
  "event AllowanceCreated(address indexed payer, address indexed recipient, address token, uint256 amount, uint256 period)",
  "function getAllowance(address payer, address recipient, address token) view returns (uint256 amount, uint256 period, uint256 lastWithdraw, bool isActive, uint256 nextWithdrawTime)",
  "function withdraw(address payer, address token)"
];

const contract = new ethers.Contract(contractAddress, abi, wallet);
const LOG_CHUNK_SIZE = 50_000;

async function getAllowanceCreatedEvents() {
  const filter = contract.filters.AllowanceCreated(null, merchantAddress);
  const latestBlock = await provider.getBlockNumber();
  const configuredStartBlock = Number(process.env.START_BLOCK || 0);
  const startBlock = Number.isFinite(configuredStartBlock)
    ? configuredStartBlock
    : 0;
  const events = [];

  for (
    let fromBlock = startBlock;
    fromBlock <= latestBlock;
    fromBlock += LOG_CHUNK_SIZE + 1
  ) {
    const toBlock = Math.min(fromBlock + LOG_CHUNK_SIZE, latestBlock);
    const chunk = await contract.queryFilter(filter, fromBlock, toBlock);
    events.push(...chunk);
  }

  return events;
}

// 3. الدالة الرئيسية لفحص وسحب الاشتراكات
async function processRecurringPayments() {
  console.log(`\n🔄 [${new Date().toLocaleString()}] بدء فحص الاشتراكات...`);

  try {
    // جلب كل أحداث إنشاء الاشتراكات من البلوكشين
    const events = await getAllowanceCreatedEvents();

    if (events.length === 0) {
      console.log("✅ لا توجد اشتراكات مسجلة لهذا التاجر.");
      return;
    }

    console.log(`📊 تم العثور على ${events.length} اشتراك(ات) محتملة.`);

    for (const event of events) {
      // queryFilter قد يعيد Log عادياً دون args؛ نتجاهله بأمان.
      if (!("args" in event)) continue;

      const { payer, token } = event.args as unknown as {
        payer: string;
        token: string;
      };
      
      // قراءة حالة الاشتراك الحالية من العقد
      const allowance = await contract.getAllowance(payer, merchantAddress, token);
      const [amount, period, lastWithdraw, isActive, nextWithdrawTime] = allowance;

      // التحقق: هل الاشتراك نشط؟ وهل حان وقت السحب؟
      const currentTime = BigInt(Math.floor(Date.now() / 1000));
      
      if (isActive && currentTime >= nextWithdrawTime) {
        console.log(`💰 محاولة سحب من المستخدم: ${payer}...`);
        
        try {
          // محاولة تنفيذ عملية السحب
          const tx = await contract.withdraw(payer, token);
          console.log(`⏳ تم إرسال المعاملة، بانتظار التأكيد... Hash: ${tx.hash}`);
          
          const receipt = await tx.wait();
          console.log(`✅ تم السحب بنجاح! Block: ${receipt.blockNumber}`);
          
        } catch (error: any) {
          // معالجة الأخطاء (مثلاً: المستخدم ليس لديه رصيد كافٍ في محفظته)
          if (error.message.includes("insufficient funds") || error.message.includes("ERC20: transfer amount exceeds balance")) {
            console.warn(`⚠️ فشل السحب من ${payer}: الرصيد غير كافٍ. سيتم التخطي والمحاولة في الدورة القادمة.`);
          } else {
            console.error(`❌ خطأ غير متوقع أثناء السحب من ${payer}:`, error.message);
          }
        }
      } else {
        // console.log(`⏸️ الاشتراك لـ ${payer} لم يحن وقته بعد أو تم إلغاؤه.`);
      }
    }
  } catch (error) {
    console.error("❌ خطأ فادح في سكريبت الفحص:", error);
  }
}

// 4. جدولة المهمة (Cron Job)
// سيعمل هذا السكريبت كل يوم في منتصف الليل (أو يمكنك تغييره ليعمل كل ساعة)
console.log("🚀 تم تشغيل عامل الاشتراكات اللامركزي...");
console.log("⏰ الجدولة: سيعمل كل يوم في الساعة 12:00 منتصف الليل.");

// تشغيل فوري عند بدء التشغيل (للاختبار)
processRecurringPayments();

// جدولة العمل التلقائي (كل يوم الساعة 00:00)
cron.schedule("0 0 * * *", () => {
  processRecurringPayments();
});
