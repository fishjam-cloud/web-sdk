#!/bin/sh

set -e

ROOTDIR=$(dirname $(dirname "$(readlink -f $0)"))

cd $ROOTDIR

printf "Synchronising submodules... "
git submodule sync --recursive >> /dev/null
git submodule update --recursive --remote --init >> /dev/null
printf "DONE\n"

cd ./protos/

files=$(find fishjam -name "*.proto")

for file in $files; do
    printf "Compiling file $file... "
    protoc --plugin=../../../node_modules/.bin/protoc-gen-ts_proto --ts_proto_out=../src/protos $file
    printf "DONE\n"
  count=$(($count + 1))
done



