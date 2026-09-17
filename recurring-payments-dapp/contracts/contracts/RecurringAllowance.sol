// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RecurringAllowance
 * @desc عقد ذكي لإدارة الاشتراكات والسحوبات المتكررة بدون أطراف خارجية.
 */
contract RecurringAllowance is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // هيكل البيانات للتفويض (الاشتراك)
    struct Allowance {
        address token;        // عنوان العملة (مثلاً USDC)
        uint256 amount;       // المبلغ المسموح سحبه كل دورة
        uint256 period;       // مدة الدورة بالثواني (مثلاً 30 يوم)
        uint256 lastWithdraw; // وقت آخر سحب ناجح
        bool isActive;        // حالة الاشتراك
    }

    // خريطة التخزين: الدافع => المستفيد => العملة => تفاصيل التفويض
    mapping(address => mapping(address => mapping(address => Allowance))) public allowances;

    // إعدادات رسوم المنصة
    address public platformFeeCollector;
    uint256 public platformFeeBps; // الرسوم بالنقاط الأساسية (10000 = 100%)

    // الأحداث (Events) لتتبع العمليات
    event AllowanceCreated(address indexed payer, address indexed recipient, address token, uint256 amount, uint256 period);
    event FundsWithdrawn(address indexed payer, address indexed recipient, address token, uint256 amount, uint256 fee);
    event AllowanceCancelled(address indexed payer, address indexed recipient, address token);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    modifier onlyCollector() {
        require(msg.sender == platformFeeCollector, "Only fee collector");
        _;
    }

    constructor(address _feeCollector, uint256 _feeBps) {
        require(_feeCollector != address(0), "Invalid collector address");
        require(_feeBps <= 1000, "Fee cannot exceed 10%"); // حد أقصى 10%
        platformFeeCollector = _feeCollector;
        platformFeeBps = _feeBps;
    }

    /**
     * @notice إنشاء تفويض جديد (اشتراك)
     */
    function createAllowance(
        address recipient,
        address token,
        uint256 amount,
        uint256 period
    ) external {
        require(recipient != address(0), "Invalid recipient");
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(period >= 1 days, "Min period is 1 day");

        Allowance storage a = allowances[msg.sender][recipient][token];
        require(!a.isActive, "Allowance already active");

        allowances[msg.sender][recipient][token] = Allowance({
            token: token,
            amount: amount,
            period: period,
            lastWithdraw: block.timestamp,
            isActive: true
        });

        emit AllowanceCreated(msg.sender, recipient, token, amount, period);
    }

    /**
     * @notice سحب الأموال (يستدعيها التاجر/المستفيد)
     */
    function withdraw(address payer, address token) external nonReentrant {
        Allowance storage a = allowances[payer][msg.sender][token];
        
        require(a.isActive, "Allowance not active");
        require(block.timestamp >= a.lastWithdraw + a.period, "Period not elapsed");

        // حساب المبلغ ورسوم المنصة
        uint256 feeAmount = (a.amount * platformFeeBps) / 10000;
        uint256 netAmount = a.amount - feeAmount;

        // تحديث وقت السحب (Effects)
        a.lastWithdraw = block.timestamp;

        // تحويل الأموال (Interactions)
        IERC20(a.token).safeTransferFrom(payer, msg.sender, netAmount);
        
        if (feeAmount > 0) {
            IERC20(a.token).safeTransferFrom(payer, platformFeeCollector, feeAmount);
        }

        emit FundsWithdrawn(payer, msg.sender, token, netAmount, feeAmount);
    }

    /**
     * @notice إلغاء التفويض (يستدعيها الدافع/المشترك)
     */
    function cancelAllowance(address recipient, address token) external {
        Allowance storage a = allowances[msg.sender][recipient][token];
        require(a.isActive, "Allowance not active");

        a.isActive = false;
        emit AllowanceCancelled(msg.sender, recipient, token);
    }

    /**
     * @notice قراءة تفاصيل التفويض
     */
    function getAllowance(address payer, address recipient, address token) 
        external view returns (uint256 amount, uint256 period, uint256 lastWithdraw, bool isActive, uint256 nextWithdrawTime) 
    {
        Allowance storage a = allowances[payer][recipient][token];
        nextWithdrawTime = a.isActive ? a.lastWithdraw + a.period : 0;
        return (a.amount, a.period, a.lastWithdraw, a.isActive, nextWithdrawTime);
    }

    // دوال إدارية لتحديث رسوم المنصة
    function setFeeCollector(address _newCollector) external onlyCollector {
        require(_newCollector != address(0), "Invalid address");
        emit FeeCollectorUpdated(platformFeeCollector, _newCollector);
        platformFeeCollector = _newCollector;
    }

    function setPlatformFeeBps(uint256 _newFeeBps) external onlyCollector {
        require(_newFeeBps <= 1000, "Fee cannot exceed 10%");
        emit FeeUpdated(platformFeeBps, _newFeeBps);
        platformFeeBps = _newFeeBps;
    }
}
