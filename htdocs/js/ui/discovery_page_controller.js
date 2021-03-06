define(['angular'], function(angular) {

   'use strict';

    return angular.module('myapp.discovery', [])
    .directive("thumbnail", function(){
        return {
            restrict: "E",
            replace: true,
            templateUrl: "grid-item.html",
            link: function(scope, iElement, iAttrs, controller){
                // console.log($vid);
                iElement.find('img').bind("error" , function(e){ 
                    $(this).attr('src', './img/missing.png');
                });

            }
        }
    })
    .controller('DiscoveryPageController', ['$scope', '$q', '$timeout', function ($scope, $q, $timeout) {

        $scope.recentNotebooks = [];

        function init() {

            //get the recent notebooks
            rcloud.config.get_recent_notebooks()
            .then(function(data){
                var sorted = _.chain(data)
                .pairs()
                .filter(function(kv) { 
                    return kv[0] != 'r_attributes' && kv[0] != 'r_type' && !_.isEmpty(editor.get_notebook_info(kv[0])) ; 
                })
                .map(function(kv) { return [kv[0], Date.parse(kv[1])]; })
                .sortBy(function(kv) { return kv[1] * -1; })
                .value();

                //sorted.shift();//remove the first item
                sorted = sorted.slice(0, 20); //limit to 20 entries


                for(var i = 0; i < sorted.length; i ++) {

                    var currItem = sorted[i];
      
                    var currentNotebook = editor.get_notebook_info(sorted[i][0]);
                  
                    var data = {
                        id: currItem[0],
                        time: currItem[1],
                        description: currentNotebook.description,
                        last_commit: new Date(currentNotebook.last_commit).toDateString(),
                        username: currentNotebook.username
                    };
                    $scope.recentNotebooks.push(data);                   
                }

                _.delay(function() {

                    var imgLoad = imagesLoaded( $('.grid')[0] );
                    imgLoad.on( 'always', function( instance ) {
                        console.log('ALWAYS - all images have been loaded');

                        _.delay(function() {
                            new Masonry( '.grid', {
                              itemSelector: '.grid-item'      
                            });
                        }, 200);

                        _.delay(function() {
                            $('.grid').css('visibility', 'visible');  
                            $('#discoveryLoader').css('display', 'none');  
                        }, 400)
                    });

                }, 300);
            
            })
        };

        $scope.getThumbUrl = function(id) {
            return "/notebook.R/"+id+"/thumb.png";
        }

        $scope.thumbClicked = function() {
            console.log('clicked');
        }

        init();


    }]);
});
