/** Read-only smoke of the cold-calling page data path (getQueue/getNextLead/stats). */
import 'dotenv/config';
import { getQueue, getNextLead } from '@/lib/cold-calling/queue';
import { getColdCallingStats, getVaStats } from '@/lib/cold-calling/stats';
import { prisma } from '@/lib/db';

(async () => {
  try {
    const q = await getQueue(25);
    console.log('getQueue OK: counts =', JSON.stringify(q.counts), '| activeLead =', q.activeLead?.companyName ?? 'none');
    const n = await getNextLead();
    console.log('getNextLead OK: next =', n.lead?.companyName ?? 'none', '| bucket =', n.queueType);
    const s = await getColdCallingStats('week');
    console.log('getColdCallingStats OK | queueDepth =', JSON.stringify(s.queueDepth));
    const u =
      (await prisma.user.findFirst({ where: { role: 'va' }, select: { id: true } })) ??
      (await prisma.user.findFirst({ select: { id: true } }));
    const va = await getVaStats(u!.id, 'week');
    const sameKeys = JSON.stringify(Object.keys(va).sort()) === JSON.stringify(Object.keys(s).sort());
    console.log('getVaStats OK: hasQueueDepth =', 'queueDepth' in va, '| uniform shape vs admin =', sameKeys);
    console.log('\nOK cold-calling page data path works');
  } catch (e) {
    console.error('PAGE DATA PATH ERROR:', (e as Error).message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
