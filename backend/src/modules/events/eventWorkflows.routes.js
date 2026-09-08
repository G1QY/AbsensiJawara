const router = require('express').Router();
const supabase = require('../../config/supabaseClient');
const requireRole = require('../../middlewares/requireRole');

router.use(requireRole('SUPER_ADMIN', 'ADMIN_STORE', 'EVENT_MANAGER'));

router.get('/:eventId', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('event_workflows')
      .select('event_id, data, current_step, max_reached, updated_at')
      .eq('event_id', req.params.eventId)
      .maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    res.json(data || { event_id: req.params.eventId, data: {}, current_step: 1, max_reached: 1 });
  } catch (err) {
    next(err);
  }
});

router.put('/:eventId', (req,res)=>res.status(405).json({message:'Gunakan endpoint workflow crew dengan validasi dan versi data.'}));

module.exports = router;
