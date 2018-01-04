const ethUtils = require('ethereumjs-util')
const ethBlock = require('ethereumjs-block/from-rpc')
const angular = require('angular')
const $ = require('jquery')
const Web3 = require('web3')
const web3 = new Web3();
const BN = require('bn.js')

const ListMax = 10

var endpoint = 'wss://rinkeby-rpc.6120.eu/ws'
var hostUrl = 'https://6120.eu'
var urlLabel = 'Rinkeby/6120'

var provider = new web3.providers.WebsocketProvider(endpoint)
web3.setProvider(provider)
app = angular.module('clixplorer', [])
var Hash = getParameterByName('hash')

function getScope(ctrlName) {
	return angular.element($('#'+ctrlName)).scope();
}

function getParameterByName(name) {
	url = window.location.href;
	name = name.replace(/[\[\]]/g, "\\$&");
	var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
		results = regex.exec(url);
	if (!results) return null;
	if (!results[2]) return '';
	return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function getSigner(block) {
	var sealers = block.extraData
	if (sealers.length <= 130)
		return undefined
	var sig = ethUtils.fromRpcSig('0x' + sealers.substring(sealers.length - 130, sealers.length)) // remove signature
	block.extraData = block.extraData.substring(0, block.extraData.length - 130)
	var blk = ethBlock(block)
	blk.header.difficulty[0] = block.difficulty
	var sigHash = ethUtils.sha3(blk.header.serialize())
	var pubkey = ethUtils.ecrecover(sigHash, sig.v, sig.r, sig.s)
	return ethUtils.pubToAddress(pubkey).toString('hex')
}

function updateInfo($scope, block) {
	$scope.info = {BestBlockNumber: block.number,
		LastSigner: getSigner(block)}
}

function updateTransaction($scope, txs) {
	var totalValue = new BN('0', 10)
	for (var i = 0; i < txs.length; i++) {
		if (i < ListMax) $scope.txs.unshift(txs[i])
		totalValue = totalValue.add(new BN(String(txs[i].value), 10))
	}
	var l = $scope.txs.length - ListMax
	$scope.txs.splice(ListMax, l)
	return {totalValue: totalValue}
}

function formatBlock($scope, hash) {
	$scope.web3.eth.getBlock(hash, true, function (error, block) {
		if (error) {
			console.log('error:' + error)
			console.log(error)
			return
		}
		txInfo = updateTransaction($scope, block.transactions)
		var tmplBlock = {Hash: hash,
			'Number': block.number,
			Signer: getSigner(block),
			Time: block.timestamp,
			TransactionsNumber: block.transactions.length,
			TotalValue: txInfo['totalValue'].toString()
		}

		$scope.blocks.unshift(tmplBlock)
		var l = $scope.blocks.length - ListMax
		$scope.blocks.splice(ListMax, l)
		$scope.$apply()
	})
}

function updateHeaderCard($scope) {
	$scope.web3.eth.getBlock("latest").then(function (block, error) {
		if (!error) {
			updateInfo($scope, block)
			if (typeof($scope.callback) == "function")
				$scope.callback(block)
			$scope.$apply()
		} else {
			console.log('Error:'+error)
			console.log(error)
		}
		$scope.web3.eth.subscribe('newBlockHeaders', function(error, block) {
			if (error) {
				console.log('Error:'+error)
				console.log(error)
				return
			}
			updateInfo($scope, block)
			if (typeof($scope.callback) == "function")
				$scope.callback(block)
			$scope.$apply()
		})
	})
}

app.controller('header', function HeaderCtl($scope) {
	$scope.web3 = web3
	updateHeaderCard($scope)
}).
controller('nav', function NavCtl($scope, $location) {
	$scope.url = hostUrl
	$scope.urlLabel = urlLabel
	$scope.processRequest = function () {
		if ($scope.search!==undefined){
			var s = $scope.search
			var regexpTx = /[0-9a-zA-Z]{64}?/;
			var regexpAddr = /^(0x)?[0-9a-f]{40}$/; //New ETH Regular Expression for Addresses
			var regexpBlock = /[0-9]{1,7}?/;
			if (regexpTx.test(s)) {
				window.location = 'tx.html?hash='+s;
			} else {
				if (regexpAddr.test(s.toLowerCase())) {
					window.location = 'account.html?hash='+s;
				} else {
					if (regexpBlock.test(s))
						window.location = 'block.html?hash='+s;
				}
			}
		}
	}
}).
controller('main', function MainCtl($scope) {
	$scope.web3 = web3
	$scope.blocks = []
	$scope.txs = []

	getScope('header').callback = (block) => formatBlock($scope, block.hash)
}).
controller('transaction', function TxCtl($scope) {
	$scope.web3 = web3
	$scope.web3.eth.getTransaction(Hash, function (error, tx) {
		if (error) {
			console.log('Error:'+error)
			console.log(error)
			return
		}
		if (tx == undefined) {
			console.log('No transaction found')
			return
		}
		if (typeof $scope.info == "undefined")
			$scope.info = {BestBlockNumber: tx.blockNumber}
		$scope.web3.eth.getTransactionReceipt(tx.hash, function (error, txReceipt) {
			$scope.tx = Object.assign({}, tx, txReceipt)
			$scope.$apply()
		})
	})
}).
controller('block', function BlockCtl($scope) {
	$scope.web3 = web3
	$scope.web3.eth.getBlock(Hash, true, function (error, block) {
		if (error) {
			console.log('Error:'+error)
			console.log(error)
			return
		}
		$scope.block = block
		$scope.block.sealer = getSigner(block)
		$scope.$apply()
	})
}).
controller('account', function AccountCtl($scope) {
	$scope.web3 = web3
	$scope.address = Hash
	$scope.web3.eth.getBalance(Hash, function (error, balance) {
		if (error) {
			console.log('Error:'+error)
			console.log(error)
			return
		}
		$scope.balance = balance
		$scope.web3.eth.getCode(Hash, function (error, code) {
			if (error) {
				console.log('Error:'+error)
				console.log(error)
				return
			}
			$scope.code = code
			$scope.$apply()
		})
	})
	$scope.logs = []
	$scope.web3.eth.subscribe('logs', {address: Hash}, function(error, log) {
		if (error) {
			console.log('Error:'+error)
			console.log(error)
			return
		}
		$scope.logs.unshift(log)
		var l = $scope.logs.length - ListMax
		$scope.logs.splice(ListMax, l)
		$scope.web3.eth.getBalance(Hash, function (error, balance) {
			if (error) {
				console.log('Error:'+error)
				console.log(error)
				return
			}
			$scope.balance = balance
			$scope.$apply()
		})
	})
}).
filter('fromWei', function () {
		return function (text, unit) {
		if (unit == undefined)
			unit = 'ether'

		if (text == undefined)
			return 'undefined'

		return web3.utils.fromWei(String(text), unit) + ' ' + unit
	}
}).
filter('toAddressOrContract', function () {
		return function (text, length, contract) {
		if (isNaN(length))
			length = 16

		var end = '…'

		if (text === null)
			return contract + ' [new]'

		if (length >= String(text).length)
			end = ''

		return String(text).substring(0, length) + end
	}
}).
filter('toAddress', function () {
		return function (text, length) {
		if (isNaN(length))
			length = 16

		var end = '…'

		if (text == undefined)
			return 'new contract'
		if (text === null)
			return 'new contract'

		if (length >= String(text).length)
			end = ''

		var prefix = ''
		if (String(text).substring(0, 2) != '0x')
			prefix = '0x'
		return prefix + String(text).substring(0, length) + end
	}
}).
filter('toHash', function () {
		return function (text, length, end) {
		if (isNaN(length))
			length = 16

		if (end === undefined)
			end = '…'

		if (text === null)
			return ''

		return String(text).substring(0, length) + end
	}
})
