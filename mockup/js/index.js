const ethUtils = require('ethereumjs-util')
const ethBlock = require('ethereumjs-block/from-rpc')
const angular = require('angular')
const Web3 = require('web3')
const web3 = new Web3();

const endpoint = 'ws://localhost:8546'
const ListMax = 10

function updateInfo($scope, block) {
	$scope.info = {BestBlockNumber: block.number}
}

function updateTransaction($scope, txs) {
	var totalValue = 0
	for (var i = 0; i < txs.length; i++) {
		if (i < ListMax) $scope.txs.unshift(txs[i])
		totalValue += txs[i].value
	}
	var l = $scope.txs.length - ListMax
	$scope.txs.splice(ListMax, l)
	return {totalValue: totalValue}
}

function formatBlock($scope, blockHeaders) {
	$scope.web3.eth.getBlock(blockHeaders.hash, true, function (error, block) {
		if (error) {
			console.log('error:' + error)
			console.log(error)
			return
		}
		var sealers = block.extraData
		var sig = ethUtils.fromRpcSig('0x' + sealers.substring(sealers.length-130, sealers.length)) // remove vanity
		blockHeaders.extraData = blockHeaders.extraData.substring(0, blockHeaders.extraData.length - 130)
		var blk = ethBlock(blockHeaders)
		blk.header.difficulty[0] = 2
		var sigHash = ethUtils.sha3(blk.header.serialize())
		var pubkey = ethUtils.ecrecover(sigHash, sig.v, sig.r, sig.s)
		var signer = ethUtils.pubToAddress(pubkey).toString('hex')
		$scope.info.LastSigner = signer
		
		txInfo = updateTransaction($scope, block.transactions)
		var tmplBlock = {Hash: block.hash,
			'Number': block.number,
			Signer: signer,
			Time: block.timestamp,
			TransactionsNumber: block.transactions.length,
			TotalValue: txInfo['totalValue']
			}
		$scope.blocks.unshift(tmplBlock)
		var l = $scope.blocks.length - ListMax
		$scope.blocks.splice(ListMax, l)
		$scope.$apply()
	})
}

app = angular.module('clixplorer', [])
app.controller('main', function MainCtl($scope, $http, $timeout) {
	// var endpoint = config.get('clix.RPC_ENDPOINT')
	// TODO handle http endpoint
	var provider = new web3.providers.WebsocketProvider(endpoint)

	web3.setProvider(provider)
	$scope.web3 = web3
	$scope.blocks = []
	$scope.txs = []
	$scope.web3.eth.getBlock("latest").then(function (block, error) {
		if (error) {
			console.log('Error:'+error)
			console.log(error)
			return
		}
		updateInfo($scope, block)
		formatBlock($scope, block)
		$scope.$apply()
		$scope.web3.eth.subscribe('newBlockHeaders', function(error, block){
			if (error) {
				console.log('Error:'+error)
				console.log(error)
				return
			}
			updateInfo($scope, block)
			formatBlock($scope, block)
			$scope.$apply()
			})
	})
}).
filter('toAddress', function () {
		return function (text, length, end) {
		if (isNaN(length))
			length = 16

		if (end === undefined)
			end = '…'

		if (text === null)
			return 'New contract creation'

		return String(text).substring(0, length) + end
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
