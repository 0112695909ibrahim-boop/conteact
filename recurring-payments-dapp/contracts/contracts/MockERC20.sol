// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice توكن ERC20 بسيط للاستخدام في الاختبارات المحلية فقط.
 */
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    /**
     * @notice سكّ كمية إضافية من التوكنات للاختبارات.
     * @param to عنوان المستلم.
     * @param amount الكمية بوحدة أصغر جزء من التوكن.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
